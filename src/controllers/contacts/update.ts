import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import { ContactService } from "../../services/contactService.ts";

export function buildUpdateContact(
  service: ContactService
): FastifyPluginAsyncZod {
  return async (server) => {
    server.put(
      "/contacts/:id",
      {
        schema: {
          tags: ["Contact"],
          summary: "Update a contact",
          params: z.object({
            id: z.string().uuid("Invalid contact ID format"),
          }),
          body: z.object({
            nome: z
              .string()
              .min(2, "Nome precisa ter pelo menos 2 caracteres")
              .optional(),
            email: z.email("Email deve ter um formato válido").optional(),
            codigoZip: z
              .string()
              .min(8, "CEP deve ter pelo menos 8 caracteres")
              .optional(),
            endereco: z.string().min(1, "Endereço é obrigatório").optional(),
            numero: z.string().min(1, "Número é obrigatório").optional(),
            bairro: z.string().min(1, "Bairro é obrigatório").optional(),
            cidade: z.string().min(1, "Cidade é obrigatória").optional(),
            estado: z
              .string()
              .min(2, "Estado deve ter pelo menos 2 caracteres")
              .optional(),
            complemento: z.string().optional(),
            addPhoneNumbers: z
              .array(
                z.object({
                  numero: z
                    .string()
                    .min(10, "Telefone deve ter pelo menos 10 dígitos"),
                })
              )
              .optional(),
            deletePhoneNumbers: z
              .array(z.uuid("ID do telefone deve ser um UUID válido"))
              .optional(),
          }),
          response: {
            200: z.object({
              success: z.literal(true),
              message: z.string(),
              contactId: z.uuid(),
            }),
            400: z.object({ error: z.string(), message: z.string() }),
            404: z.object({ error: z.string(), message: z.string() }),
            409: z.object({ error: z.string(), message: z.string() }),
            500: z.object({ error: z.string(), message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const { id } = request.params;

          const result = await service.update(id, request.body);

          if ("error" in result) {
            if (result.error === "DUPLICATE_EMAIL")
              return reply.status(409).send(result);
            return reply.status(404).send(result);
          }

          return reply.status(200).send({
            success: true,
            message: "Contato atualizado com sucesso",
            contactId: result.contactId,
          });
        } catch (error: any) {
          if (error.code === "23505" && error.constraint?.includes("email")) {
            return reply.status(409).send({
              error: "DUPLICATE_EMAIL",
              message: "Este email já está cadastrado",
            });
          }

          if (error.code === "23503") {
            return reply.status(400).send({
              error: "INVALID_REFERENCE",
              message: "Referência inválida nos dados fornecidos",
            });
          }

          if (error.code) {
            return reply.status(500).send({
              error: "DATABASE_ERROR",
              message: "Erro ao atualizar contato",
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
