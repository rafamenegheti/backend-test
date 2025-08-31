import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import { ContactService } from "../../services/contactService.ts";

export function buildListContacts(
  service: ContactService
): FastifyPluginAsyncZod {
  return async (server) => {
    server.get(
      "/contacts",
      {
        schema: {
          tags: ["Contact"],
          summary: "List contacts with optional filters",
          querystring: z.object({
            search: z.string().optional(),
            ativo: z.enum(["true", "false"]).optional().default("true"),
            page: z.string().regex(/^\d+$/).transform(Number).optional(),
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
          }),
          response: {
            200: z.object({
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
                  complemento: z.string().nullable().optional(),
                  ativo: z.boolean(),
                  createdAt: z.string(),
                  updatedAt: z.string(),
                  telefones: z.array(
                    z.object({ id: z.string().uuid(), numero: z.string() })
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
            }),
            400: z.object({ error: z.string(), message: z.string() }),
            500: z.object({ error: z.string(), message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const response = await service.list(request.query);

          return reply.status(200).send(response);
        } catch (error: any) {
          if (error.code) {
            return reply.status(400).send({
              error: "DATABASE_ERROR",
              message: "Erro ao consultar contatos",
            });
          }

          return reply.status(500).send({
            error: "INTERNAL_SERVER_ERROR",
            message: "Erro interno do servidor. Tente novamente mais tarde.",
          });
        }
      }
    );
  };
}
