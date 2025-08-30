import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import { ContactService } from "../../services/contactService.ts";

export function buildDeleteContact(
  service: ContactService
): FastifyPluginAsyncZod {
  return async (server) => {
    server.delete(
      "/contacts/:id",
      {
        schema: {
          tags: ["Contact"],
          summary: "Soft delete a contact (sets ativo to false)",
          params: z.object({
            id: z.string().uuid("Invalid contact ID format"),
          }),
        },
      },
      async (request, reply) => {
        try {
          const { id } = request.params as any;
          const result = await service.softDelete(id);
          if ("error" in result) {
            return reply
              .status(result.error === "CONTACT_NOT_FOUND" ? 404 : 404)
              .send(result);
          }
          return reply.status(200).send({
            success: true,
            message: "Contato desativado com sucesso",
            contactId: result.contactId,
          });
        } catch (error: any) {
          if (error.code) {
            return reply.status(500).send({
              error: "DATABASE_ERROR",
              message: "Erro ao processar solicitação de exclusão",
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
