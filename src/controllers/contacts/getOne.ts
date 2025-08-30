import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import { ContactService } from "../../services/contactService.ts";

export function buildGetOneContact(
  service: ContactService
): FastifyPluginAsyncZod {
  return async (server) => {
    server.get(
      "/contacts/:id",
      {
        schema: {
          tags: ["Contact"],
          summary: "Get a specific contact with weather information",
          params: z.object({
            id: z.string().uuid("Invalid contact ID format"),
          }),
        },
      },
      async (request, reply) => {
        try {
          const { id } = request.params as any;

          const result = await service.getWithWeather(id);

          if ("error" in result) {
            return reply.status(404).send(result);
          }

          return reply.status(200).send(result);
        } catch (error: any) {
          if (error.code) {
            return reply.status(500).send({
              error: "DATABASE_ERROR",
              message: "Erro ao consultar contato",
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
