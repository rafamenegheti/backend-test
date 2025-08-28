import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "../../database/client.ts";
import { contatos } from "../../database/schema.ts";
import { eq } from "drizzle-orm";
import z from "zod";

export const deleteContactRoute: FastifyPluginAsyncZod = async (server) => {
  server.delete(
    "/contacts/:id",
    {
      schema: {
        tags: ["Contact"],
        summary: "Soft delete a contact (sets ativo to false)",
        params: z.object({
          id: z.string().uuid("Invalid contact ID format"),
        }),
        response: {
          200: z
            .object({
              success: z.boolean(),
              message: z.string(),
              contactId: z.string().uuid(),
            })
            .describe("Contact successfully deactivated"),
          404: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Contact not found or already inactive"),
          400: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Invalid contact ID format"),
          500: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Internal server error"),
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        // First, check if the contact exists and is currently active
        const existingContact = await db
          .select({
            id: contatos.id,
            nome: contatos.nome,
            ativo: contatos.ativo,
          })
          .from(contatos)
          .where(eq(contatos.id, id))
          .limit(1);

        if (existingContact.length === 0) {
          return reply.status(404).send({
            error: "CONTACT_NOT_FOUND",
            message: "Contato não encontrado",
          });
        }

        const contact = existingContact[0];

        // Check if contact is already inactive
        if (!contact.ativo) {
          return reply.status(404).send({
            error: "CONTACT_ALREADY_INACTIVE",
            message: "Contato já está inativo",
          });
        }

        // Perform soft delete - set ativo to false
        const updatedContact = await db
          .update(contatos)
          .set({
            ativo: false,
            updatedAt: new Date(),
          })
          .where(eq(contatos.id, id))
          .returning({ id: contatos.id });

        if (updatedContact.length === 0) {
          return reply.status(500).send({
            error: "DELETE_FAILED",
            message: "Falha ao desativar contato",
          });
        }

        return reply.status(200).send({
          success: true,
          message: "Contato desativado com sucesso",
          contactId: updatedContact[0].id,
        });
      } catch (error: any) {
        // Handle specific database errors
        if (error.code) {
          return reply.status(500).send({
            error: "DATABASE_ERROR",
            message: "Erro ao processar solicitação de exclusão",
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
