import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "../../database/client.ts";
import { contatos, telefones } from "../../database/schema.ts";
import z from "zod";

export const createContactRoute: FastifyPluginAsyncZod = async (server) => {
  server.post(
    "/contacts",
    {
      schema: {
        tags: ["Contact"],
        summary: "Create a contact",
        body: z.object({
          nome: z.string().min(2, "Nome precisa ter pelo menos 2 caracteres"),
          email: z.email("Email deve ter um formato válido"),
          codigoZip: z.string().min(8, "CEP deve ter pelo menos 8 caracteres"),
          endereco: z.string().min(1, "Endereço é obrigatório"),
          numero: z.string().min(1, "Número é obrigatório"),
          bairro: z.string().min(1, "Bairro é obrigatório"),
          cidade: z.string().min(1, "Cidade é obrigatória"),
          estado: z.string().min(2, "Estado deve ter pelo menos 2 caracteres"),
          complemento: z.string().optional(),
          telefones: z
            .array(
              z.object({
                numero: z
                  .string()
                  .min(10, "Telefone deve ter pelo menos 10 dígitos"),
              })
            )
            .optional(),
        }),
        response: {
          201: z
            .object({ contactId: z.uuid() })
            .describe("Contato criado com sucesso!"),
          400: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Dados inválidos"),
          409: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Email já cadastrado"),
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
        const { telefones: phoneNumbers, ...contactData } = request.body;

        const newContact = await db.transaction(async (tx) => {
          const [newContact] = await tx
            .insert(contatos)
            .values(contactData)
            .returning();

          if (phoneNumbers && phoneNumbers.length > 0) {
            await tx.insert(telefones).values(
              phoneNumbers.map((phone) => ({
                numero: phone.numero,
                contatoId: newContact.id,
              }))
            );
          }

          return newContact;
        });

        return reply.status(201).send({ contactId: newContact.id });
      } catch (error: any) {
        // Handle unique constraint violation (duplicate email)
        if (
          error.cause.code === "23505" &&
          error.cause.constraint?.includes("email")
        ) {
          return reply.status(409).send({
            error: "DUPLICATE_EMAIL",
            message: "Este email já está cadastrado",
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
