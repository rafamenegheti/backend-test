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
        },
      },
      async (request, reply) => {
        try {
          const response = await service.list(request.query as any);
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
