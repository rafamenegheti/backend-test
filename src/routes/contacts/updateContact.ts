import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "../../database/client.ts";
import { contatos, telefones } from "../../database/schema.ts";
import { eq } from "drizzle-orm";
import z from "zod";

export const updateContactRoute: FastifyPluginAsyncZod = async (server) => {
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
          200: z
            .object({
              success: z.boolean(),
              message: z.string(),
              contactId: z.string().uuid(),
            })
            .describe("Contato atualizado com sucesso!"),
          400: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Dados inválidos"),
          404: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Contato não encontrado"),
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
        const { id } = request.params;
        const { addPhoneNumbers, deletePhoneNumbers, ...contactData } =
          request.body;

        // Check if contact exists
        const existingContact = await db
          .select({
            id: contatos.id,
            email: contatos.email,
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

        // Check for email conflicts if email is being updated
        if (
          contactData.email &&
          contactData.email !== existingContact[0].email
        ) {
          const emailConflict = await db
            .select({ id: contatos.id })
            .from(contatos)
            .where(eq(contatos.email, contactData.email))
            .limit(1);

          if (emailConflict.length > 0) {
            return reply.status(409).send({
              error: "DUPLICATE_EMAIL",
              message: "Este email já está cadastrado",
            });
          }
        }

        // Update the contact
        const updatedContact = await db
          .update(contatos)
          .set({
            ...contactData,
            updatedAt: new Date(),
          })
          .where(eq(contatos.id, id))
          .returning({ id: contatos.id });

        if (updatedContact.length === 0) {
          return reply.status(500).send({
            error: "UPDATE_FAILED",
            message: "Falha ao atualizar contato",
          });
        }

        // Handle phone numbers deletion if provided
        if (deletePhoneNumbers && deletePhoneNumbers.length > 0) {
          // Verify that phone numbers belong to this contact before deleting
          const phoneOwnership = await db
            .select({ id: telefones.id })
            .from(telefones)
            .where(eq(telefones.contatoId, id));

          const validPhoneIds = phoneOwnership.map((p) => p.id);
          const phoneIdsToDelete = deletePhoneNumbers.filter((phoneId) =>
            validPhoneIds.includes(phoneId)
          );

          if (phoneIdsToDelete.length > 0) {
            for (const phoneId of phoneIdsToDelete) {
              await db.delete(telefones).where(eq(telefones.id, phoneId));
            }
          }

          // Log warning if some phone IDs were not found/don't belong to contact
          if (phoneIdsToDelete.length !== deletePhoneNumbers.length) {
            console.warn(
              `Some phone IDs not found or don't belong to contact ${id}`
            );
          }
        }

        // Handle adding new phone numbers if provided
        if (addPhoneNumbers && addPhoneNumbers.length > 0) {
          await db.insert(telefones).values(
            addPhoneNumbers.map((phone) => ({
              numero: phone.numero,
              contatoId: id,
            }))
          );
        }

        return reply.status(200).send({
          success: true,
          message: "Contato atualizado com sucesso",
          contactId: updatedContact[0].id,
        });
      } catch (error: any) {
        // Handle unique constraint violation (duplicate email)
        if (error.code === "23505" && error.constraint?.includes("email")) {
          return reply.status(409).send({
            error: "DUPLICATE_EMAIL",
            message: "Este email já está cadastrado",
          });
        }

        // Handle foreign key constraint violations
        if (error.code === "23503") {
          return reply.status(400).send({
            error: "INVALID_REFERENCE",
            message: "Referência inválida nos dados fornecidos",
          });
        }

        // Handle specific database errors
        if (error.code) {
          return reply.status(500).send({
            error: "DATABASE_ERROR",
            message: "Erro ao atualizar contato",
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
