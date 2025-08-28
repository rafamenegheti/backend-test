import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import {
  createTestApp,
  createTestContact,
  createTestPhone,
  clearDatabase,
} from "../../utils";
import { testDb } from "../../setup";
import { contatos, telefones } from "../../../database/schema";
import { eq } from "drizzle-orm";

describe("PUT /contacts/:id", () => {
  let app: any;

  beforeEach(async () => {
    await clearDatabase();
    app = await createTestApp();
  });

  it("should update all contact fields", async () => {
    const contact = await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
      codigoZip: "12345678",
      endereco: "Rua Antiga",
      numero: "100",
      bairro: "Bairro Antigo",
      cidade: "Cidade Antiga",
      estado: "SP",
      complemento: "Complemento Antigo",
    });

    const updateData = {
      nome: "João Silva Atualizado",
      email: "joao.novo@test.com",
      codigoZip: "87654321",
      endereco: "Av. Nova",
      numero: "200",
      bairro: "Bairro Novo",
      cidade: "Cidade Nova",
      estado: "RJ",
      complemento: "Complemento Novo",
    };

    const response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: "Contato atualizado com sucesso",
      contactId: contact.id,
    });

    // Verify contact was updated in database
    const updatedContact = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, contact.id));

    expect(updatedContact[0]).toMatchObject(updateData);
    expect(updatedContact[0].updatedAt.getTime()).toBeGreaterThan(
      updatedContact[0].createdAt.getTime()
    );
  });

  it("should update partial contact fields", async () => {
    const contact = await createTestContact({
      nome: "Maria Santos",
      email: "maria@test.com",
      cidade: "São Paulo",
    });

    const updateData = {
      nome: "Maria Santos Atualizada",
      cidade: "Rio de Janeiro",
      // Only updating name and city
    };

    const response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: "Contato atualizado com sucesso",
      contactId: contact.id,
    });

    // Verify only specified fields were updated
    const updatedContact = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, contact.id));

    expect(updatedContact[0]).toMatchObject({
      nome: "Maria Santos Atualizada",
      email: "maria@test.com", // Unchanged
      cidade: "Rio de Janeiro",
    });
  });

  it("should add new phone numbers", async () => {
    const contact = await createTestContact({
      nome: "Pedro Silva",
      email: "pedro@test.com",
    });

    const updateData = {
      addPhoneNumbers: [{ numero: "11987654321" }, { numero: "11933334444" }],
    };

    const response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send(updateData)
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify phone numbers were added
    const phones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, contact.id));

    expect(phones).toHaveLength(2);
    expect(phones.map((p) => p.numero)).toEqual(
      expect.arrayContaining(["11987654321", "11933334444"])
    );
  });

  it("should delete specific phone numbers", async () => {
    const contact = await createTestContact({
      nome: "Ana Silva",
      email: "ana@test.com",
    });

    // Create phone numbers first
    const phone1 = await createTestPhone(contact.id, "11111111111");
    const phone2 = await createTestPhone(contact.id, "22222222222");
    const phone3 = await createTestPhone(contact.id, "33333333333");

    const updateData = {
      deletePhoneNumbers: [phone1.id, phone3.id],
      // Delete phone1 and phone3, keep phone2
    };

    const response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send(updateData)
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify only phone2 remains
    const remainingPhones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, contact.id));

    expect(remainingPhones).toHaveLength(1);
    expect(remainingPhones[0].id).toBe(phone2.id);
    expect(remainingPhones[0].numero).toBe("22222222222");
  });

  it("should add and delete phone numbers simultaneously", async () => {
    const contact = await createTestContact({
      nome: "Carlos Silva",
      email: "carlos@test.com",
    });

    // Create existing phone numbers
    const existingPhone = await createTestPhone(contact.id, "11111111111");
    await createTestPhone(contact.id, "22222222222");

    const updateData = {
      addPhoneNumbers: [{ numero: "33333333333" }, { numero: "44444444444" }],
      deletePhoneNumbers: [existingPhone.id],
    };

    const response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send(updateData)
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify phone numbers were added and deleted correctly
    const phones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, contact.id));

    expect(phones).toHaveLength(3); // 2 existing - 1 deleted + 2 added
    expect(phones.map((p) => p.numero)).toEqual(
      expect.arrayContaining(["22222222222", "33333333333", "44444444444"])
    );
    expect(phones.map((p) => p.numero)).not.toContain("11111111111");
  });

  it("should update contact and manage phone numbers together", async () => {
    const contact = await createTestContact({
      nome: "Laura Santos",
      email: "laura@test.com",
    });

    const existingPhone = await createTestPhone(contact.id, "11111111111");

    const updateData = {
      nome: "Laura Santos Atualizada",
      email: "laura.nova@test.com",
      addPhoneNumbers: [{ numero: "22222222222" }],
      deletePhoneNumbers: [existingPhone.id],
    };

    const response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send(updateData)
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify contact was updated
    const updatedContact = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, contact.id));

    expect(updatedContact[0]).toMatchObject({
      nome: "Laura Santos Atualizada",
      email: "laura.nova@test.com",
    });

    // Verify phone numbers were managed correctly
    const phones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, contact.id));

    expect(phones).toHaveLength(1);
    expect(phones[0].numero).toBe("22222222222");
  });

  it("should return 404 for non-existent contact", async () => {
    const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";

    const response = await supertest(app.server)
      .put(`/contacts/${nonExistentId}`)
      .send({ nome: "Test" })
      .expect(404);

    expect(response.body).toMatchObject({
      error: "CONTACT_NOT_FOUND",
      message: "Contato não encontrado",
    });
  });

  it("should return 400 for invalid UUID format", async () => {
    const response = await supertest(app.server)
      .put("/contacts/invalid-uuid")
      .send({ nome: "Test" })
      .expect(400);

    expect(response.body).toMatchObject({
      message: expect.stringContaining("Invalid contact ID format"),
    });
  });

  it("should return 409 for duplicate email", async () => {
    // Create two contacts
    const contact1 = await createTestContact({
      nome: "Contact 1",
      email: "contact1@test.com",
    });
    const contact2 = await createTestContact({
      nome: "Contact 2",
      email: "contact2@test.com",
    });

    // Try to update contact2 with contact1's email
    const response = await supertest(app.server)
      .put(`/contacts/${contact2.id}`)
      .send({ email: "contact1@test.com" })
      .expect(409);

    expect(response.body).toMatchObject({
      error: "DUPLICATE_EMAIL",
      message: "Este email já está cadastrado",
    });
  });

  it("should allow updating contact with same email (no change)", async () => {
    const contact = await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
    });

    const response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send({
        nome: "João Silva Atualizado",
        email: "joao@test.com", // Same email
      })
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify update was successful
    const updatedContact = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, contact.id));

    expect(updatedContact[0].nome).toBe("João Silva Atualizado");
  });

  it("should validate field lengths and formats", async () => {
    const contact = await createTestContact({
      nome: "Test User",
      email: "test@test.com",
    });

    // Test nome too short
    let response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send({ nome: "A" })
      .expect(400);

    expect(response.body.message).toContain(
      "Nome precisa ter pelo menos 2 caracteres"
    );

    // Test invalid email
    response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send({ email: "invalid-email" })
      .expect(400);

    expect(response.body.message).toContain("Email deve ter um formato válido");

    // Test CEP too short
    response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send({ codigoZip: "123" })
      .expect(400);

    expect(response.body.message).toContain(
      "CEP deve ter pelo menos 8 caracteres"
    );

    // Test estado too short
    response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send({ estado: "S" })
      .expect(400);

    expect(response.body.message).toContain(
      "Estado deve ter pelo menos 2 caracteres"
    );

    // Test phone number too short
    response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send({
        addPhoneNumbers: [{ numero: "123" }],
      })
      .expect(400);

    expect(response.body.message).toContain(
      "Telefone deve ter pelo menos 10 dígitos"
    );
  });

  it("should ignore invalid phone IDs in deletePhoneNumbers", async () => {
    const contact = await createTestContact({
      nome: "Test User",
      email: "test@test.com",
    });

    const validPhone = await createTestPhone(contact.id, "11111111111");
    const invalidPhoneId = "123e4567-e89b-12d3-a456-426614174000";

    const updateData = {
      deletePhoneNumbers: [validPhone.id, invalidPhoneId],
    };

    const response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send(updateData)
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify valid phone was deleted, invalid ID was ignored
    const remainingPhones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, contact.id));

    expect(remainingPhones).toHaveLength(0);
  });

  it("should ignore phone IDs that belong to other contacts", async () => {
    const contact1 = await createTestContact({
      nome: "Contact 1",
      email: "contact1@test.com",
    });
    const contact2 = await createTestContact({
      nome: "Contact 2",
      email: "contact2@test.com",
    });

    const phone1 = await createTestPhone(contact1.id, "11111111111");
    const phone2 = await createTestPhone(contact2.id, "22222222222");

    // Try to delete phone2 (belongs to contact2) when updating contact1
    const updateData = {
      deletePhoneNumbers: [phone1.id, phone2.id],
    };

    const response = await supertest(app.server)
      .put(`/contacts/${contact1.id}`)
      .send(updateData)
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify only phone1 was deleted, phone2 remains for contact2
    const contact1Phones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, contact1.id));

    const contact2Phones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, contact2.id));

    expect(contact1Phones).toHaveLength(0);
    expect(contact2Phones).toHaveLength(1);
    expect(contact2Phones[0].id).toBe(phone2.id);
  });

  it("should return 400 for invalid UUID in deletePhoneNumbers array", async () => {
    const contact = await createTestContact({
      nome: "Test User",
      email: "test@test.com",
    });

    const response = await supertest(app.server)
      .put(`/contacts/${contact.id}`)
      .send({
        deletePhoneNumbers: ["invalid-uuid"],
      })
      .expect(400);

    expect(response.body.message).toContain(
      "ID do telefone deve ser um UUID válido"
    );
  });
});
