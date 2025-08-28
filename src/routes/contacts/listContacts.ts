import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "../../database/client.ts";
import { contatos, telefones } from "../../database/schema.ts";
import { eq, ilike, or, and, sql, SQL } from "drizzle-orm";
import z from "zod";

export const listContactsRoute: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/contacts",
    {
      schema: {
        tags: ["Contact"],
        summary: "List contacts with optional filters",
        querystring: z.object({
          search: z
            .string()
            .optional()
            .describe(
              "Search across all fields (name, email, address, city, state, phone numbers)"
            ),
          ativo: z
            .enum(["true", "false"])
            .optional()
            .describe("Filter by active status")
            .default("true"),
          page: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .optional()
            .describe("Page number (default: 1)"),
          limit: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .optional()
            .describe("Items per page (default: 10, max: 100)"),
        }),
        response: {
          200: z
            .object({
              contacts: z.array(
                z.object({
                  id: z.uuid(),
                  nome: z.string(),
                  email: z.string(),
                  codigoZip: z.string(),
                  endereco: z.string(),
                  numero: z.string(),
                  bairro: z.string(),
                  cidade: z.string(),
                  estado: z.string(),
                  complemento: z.string().nullable(),
                  ativo: z.boolean(),
                  createdAt: z.string(),
                  updatedAt: z.string(),
                  telefones: z.array(
                    z.object({
                      id: z.string().uuid(),
                      numero: z.string(),
                    })
                  ),
                })
              ),
              pagination: z.object({
                currentPage: z.number(),
                totalPages: z.number(),
                totalItems: z.number(),
                itemsPerPage: z.number(),
                hasNextPage: z.boolean(),
                hasPrevPage: z.boolean(),
              }),
            })
            .describe("Lista de contatos com paginação"),
          400: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Parâmetros inválidos"),
          500: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Erro interno do servidor"),
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          search,
          ativo,
          page = 1,
          limit: requestedLimit = 10,
        } = request.query;

        // Validate and limit the page size
        const limit = Math.min(requestedLimit, 100);
        const offset = (page - 1) * limit;

        // Build WHERE conditions
        const conditions: SQL<unknown>[] = [];

        // Handle search across all fields
        if (search) {
          const searchPattern = `%${search}%`;

          // First, get contact IDs that have matching phone numbers
          const contactsWithMatchingPhones = await db
            .select({ contatoId: telefones.contatoId })
            .from(telefones)
            .where(ilike(telefones.numero, searchPattern));

          const phoneMatchingIds = contactsWithMatchingPhones.map(
            (p) => p.contatoId
          );

          // Create search conditions for contact fields
          const contactSearchConditions = [
            ilike(contatos.nome, searchPattern),
            ilike(contatos.email, searchPattern),
            ilike(contatos.endereco, searchPattern),
            ilike(contatos.bairro, searchPattern),
            ilike(contatos.cidade, searchPattern),
            ilike(contatos.estado, searchPattern),
            ilike(contatos.codigoZip, searchPattern),
          ];

          // Add complemento search if not null
          contactSearchConditions.push(
            ilike(contatos.complemento, searchPattern)
          );

          // If there are phone matches, include those contact IDs
          if (phoneMatchingIds.length > 0) {
            contactSearchConditions.push(
              sql`${contatos.id} IN (${sql.join(
                phoneMatchingIds.map((id) => sql`${id}`),
                sql`,`
              )})`
            );
          }

          // Combine all search conditions with OR
          const orCondition = or(...contactSearchConditions);
          if (orCondition) {
            conditions.push(orCondition);
          }
        }

        // Handle active status filter
        if (ativo !== undefined) {
          conditions.push(eq(contatos.ativo, ativo === "true"));
        }

        // Build the main query with conditions
        const baseQuery = db
          .select({
            id: contatos.id,
            nome: contatos.nome,
            email: contatos.email,
            codigoZip: contatos.codigoZip,
            endereco: contatos.endereco,
            numero: contatos.numero,
            bairro: contatos.bairro,
            cidade: contatos.cidade,
            estado: contatos.estado,
            complemento: contatos.complemento,
            ativo: contatos.ativo,
            createdAt: contatos.createdAt,
            updatedAt: contatos.updatedAt,
          })
          .from(contatos);

        const query =
          conditions.length > 0
            ? baseQuery.where(and(...conditions))
            : baseQuery;

        // Build count query with same conditions
        const baseCountQuery = db
          .select({ count: sql`count(*)`.mapWith(Number) })
          .from(contatos);

        const countQuery =
          conditions.length > 0
            ? baseCountQuery.where(and(...conditions))
            : baseCountQuery;

        const [{ count: totalItems }] = await countQuery;

        // Execute main query with pagination
        const contacts = await query
          .orderBy(contatos.createdAt)
          .limit(limit)
          .offset(offset);

        // Get phone numbers for each contact
        const contactIds = contacts.map((c) => c.id);
        const phoneNumbers =
          contactIds.length > 0
            ? await db
                .select({
                  id: telefones.id,
                  numero: telefones.numero,
                  contatoId: telefones.contatoId,
                })
                .from(telefones)
                .where(
                  sql`${telefones.contatoId} IN (${sql.join(
                    contactIds.map((id) => sql`${id}`),
                    sql`,`
                  )})`
                )
            : [];

        // Group phone numbers by contact
        const phonesByContact = phoneNumbers.reduce((acc, phone) => {
          if (!acc[phone.contatoId]) {
            acc[phone.contatoId] = [];
          }
          acc[phone.contatoId].push({
            id: phone.id,
            numero: phone.numero,
          });
          return acc;
        }, {} as Record<string, Array<{ id: string; numero: string }>>);

        // Combine contacts with their phone numbers
        const contactsWithPhones = contacts.map((contact) => ({
          ...contact,
          createdAt: contact.createdAt.toISOString(),
          updatedAt: contact.updatedAt.toISOString(),
          telefones: phonesByContact[contact.id] || [],
        }));

        // Calculate pagination info
        const totalPages = Math.ceil(totalItems / limit);

        return reply.status(200).send({
          contacts: contactsWithPhones,
          pagination: {
            currentPage: page,
            totalPages,
            totalItems,
            itemsPerPage: limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        });
      } catch (error: any) {
        // Log the error for debugging
        console.error("Error listing contacts:", error);

        // Handle specific database errors
        if (error.code) {
          return reply.status(400).send({
            error: "DATABASE_ERROR",
            message: "Erro ao consultar contatos",
          });
        }

        // Generic server error
        return reply.status(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "Erro interno do servidor. Tente novamente mais tarde.",
        });
      }
    }
  );
};
