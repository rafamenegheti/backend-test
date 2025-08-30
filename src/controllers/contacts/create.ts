import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import { ContactService } from "../../services/contactService.ts";

export function buildCreateContact(
  service: ContactService
): FastifyPluginAsyncZod {
  return async (server) => {
    server.post(
      "/contacts",
      {
        schema: {
          tags: ["Contact"],
          summary: "Create a contact",
          body: z.object({
            nome: z.string().min(2, "Nome precisa ter pelo menos 2 caracteres"),
            email: z.email("Email deve ter um formato válido"),
            codigoZip: z
              .string()
              .min(8, "CEP deve ter pelo menos 8 caracteres"),
            endereco: z.string().min(1, "Endereço é obrigatório"),
            numero: z.string().min(1, "Número é obrigatório"),
            bairro: z.string().min(1, "Bairro é obrigatório"),
            cidade: z.string().min(1, "Cidade é obrigatória"),
            estado: z
              .string()
              .min(2, "Estado deve ter pelo menos 2 caracteres"),
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
            201: z.object({ contactId: z.uuid() }),
            400: z.object({ error: z.string(), message: z.string() }),
            409: z.object({ error: z.string(), message: z.string() }),
            500: z.object({ error: z.string(), message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const result = await service.create(request.body);

          return reply.status(201).send({ contactId: result.id });
        } catch (error: any) {
          if (
            error?.cause?.code === "23505" &&
            error?.cause?.constraint?.includes("email")
          ) {
            return reply.status(409).send({
              error: "DUPLICATE_EMAIL",
              message: "Este email já está cadastrado",
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
