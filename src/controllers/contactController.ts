import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import { ContactService } from "../services/contactService.ts";

export const buildContactController = (
  service: ContactService
): FastifyPluginAsyncZod => {
  const plugin: FastifyPluginAsyncZod = async (server) => {
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
            201: z
              .object({ contactId: z.uuid() })
              .describe("Contato criado com sucesso!"),
            400: z.object({ error: z.string(), message: z.string() }),
            409: z.object({ error: z.string(), message: z.string() }),
            500: z.object({ error: z.string(), message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const result = await service.create(request.body as any);
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
        },
      },
      async (request, reply) => {
        try {
          const { id } = request.params as any;
          const result = await service.update(id, request.body as any);
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
  return plugin;
};
