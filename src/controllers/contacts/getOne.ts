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
            id: z.uuid("Invalid contact ID format"),
          }),
          response: {
            200: z.object({
              contact: z.object({
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
                weather: z.union([
                  z.object({ error: z.string(), message: z.string() }),
                  z.object({
                    temp: z.number(),
                    condition: z.string(),
                    currently: z.string(),
                    city: z.string(),
                    suggestion: z.string(),
                    condition_code: z.string(),
                  }),
                ]),
              }),
            }),
            404: z.object({ error: z.string(), message: z.string() }),
            500: z.object({ error: z.string(), message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const { id } = request.params;

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
