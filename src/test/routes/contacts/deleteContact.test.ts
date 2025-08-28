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

describe("DELETE /contacts/:id", () => {
  let app: any;

  beforeEach(async () => {
    await clearDatabase();
    app = await createTestApp();
  });

  it("should soft delete an active contact", async () => {
    const contact = await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
      ativo: true,
    });

    const response = await supertest(app.server)
      .delete(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: "Contato desativado com sucesso",
      contactId: contact.id,
    });

    // Verify contact was soft deleted (ativo = false)
    const updatedContact = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, contact.id));

    expect(updatedContact).toHaveLength(1);
    expect(updatedContact[0]).toMatchObject({
      id: contact.id,
      ativo: false,
    });
    expect(updatedContact[0].updatedAt.getTime()).toBeGreaterThan(
      updatedContact[0].createdAt.getTime()
    );
  });

  it("should preserve phone numbers when soft deleting contact", async () => {
    const contact = await createTestContact({
      nome: "Maria Santos",
      email: "maria@test.com",
      ativo: true,
    });

    // Create phone numbers for the contact
    await createTestPhone(contact.id, "11987654321");
    await createTestPhone(contact.id, "11933334444");

    const response = await supertest(app.server)
      .delete(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify phone numbers still exist (not hard deleted)
    const phones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, contact.id));

    expect(phones).toHaveLength(2);
    expect(phones.map((p) => p.numero)).toEqual(
      expect.arrayContaining(["11987654321", "11933334444"])
    );
  });

  it("should return 404 for non-existent contact", async () => {
    const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";

    const response = await supertest(app.server)
      .delete(`/contacts/${nonExistentId}`)
      .expect(404);

    expect(response.body).toMatchObject({
      error: "CONTACT_NOT_FOUND",
      message: "Contato não encontrado",
    });
  });

  it("should return 404 for already inactive contact", async () => {
    const inactiveContact = await createTestContact({
      nome: "Inactive User",
      email: "inactive@test.com",
      ativo: false,
    });

    const response = await supertest(app.server)
      .delete(`/contacts/${inactiveContact.id}`)
      .expect(404);

    expect(response.body).toMatchObject({
      error: "CONTACT_ALREADY_INACTIVE",
      message: "Contato já está inativo",
    });

    // Verify contact remains inactive
    const contact = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, inactiveContact.id));

    expect(contact[0].ativo).toBe(false);
  });

  it("should return 400 for invalid UUID format", async () => {
    const response = await supertest(app.server)
      .delete("/contacts/invalid-uuid")
      .expect(400);

    expect(response.body).toMatchObject({
      message: expect.stringContaining("Invalid contact ID format"),
    });
  });

  it("should handle deleting contact that exists but is already inactive", async () => {
    // Create an active contact first
    const contact = await createTestContact({
      nome: "Test User",
      email: "test@test.com",
      ativo: true,
    });

    // Soft delete it first time (should succeed)
    await supertest(app.server).delete(`/contacts/${contact.id}`).expect(200);

    // Try to delete it again (should return 404 with specific message)
    const response = await supertest(app.server)
      .delete(`/contacts/${contact.id}`)
      .expect(404);

    expect(response.body).toMatchObject({
      error: "CONTACT_ALREADY_INACTIVE",
      message: "Contato já está inativo",
    });
  });

  it("should update the updatedAt timestamp when soft deleting", async () => {
    const contact = await createTestContact({
      nome: "Time Test User",
      email: "timetest@test.com",
      ativo: true,
    });

    // Get original timestamps
    const originalContact = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, contact.id));

    const originalUpdatedAt = originalContact[0].updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    await supertest(app.server).delete(`/contacts/${contact.id}`).expect(200);

    // Verify updatedAt was changed
    const updatedContact = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, contact.id));

    expect(updatedContact[0].updatedAt.getTime()).toBeGreaterThan(
      originalUpdatedAt.getTime()
    );
  });

  it("should handle UUID with different formats correctly", async () => {
    const contact = await createTestContact({
      nome: "UUID Test User",
      email: "uuidtest@test.com",
      ativo: true,
    });

    // Test with uppercase UUID
    const uppercaseId = contact.id.toUpperCase();

    const response = await supertest(app.server)
      .delete(`/contacts/${uppercaseId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      contactId: expect.any(String),
    });
  });

  it("should maintain referential integrity with phone numbers", async () => {
    const contact = await createTestContact({
      nome: "Referential Test",
      email: "ref@test.com",
      ativo: true,
    });

    const phone1 = await createTestPhone(contact.id, "11111111111");
    const phone2 = await createTestPhone(contact.id, "22222222222");

    await supertest(app.server).delete(`/contacts/${contact.id}`).expect(200);

    // Verify phone numbers still exist and reference the contact
    const phones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, contact.id));

    expect(phones).toHaveLength(2);
    expect(phones.map((p) => p.id)).toEqual(
      expect.arrayContaining([phone1.id, phone2.id])
    );
    expect(phones.every((p) => p.contatoId === contact.id)).toBe(true);
  });

  it("should allow multiple contacts to be soft deleted independently", async () => {
    const contact1 = await createTestContact({
      nome: "User 1",
      email: "user1@test.com",
      ativo: true,
    });
    const contact2 = await createTestContact({
      nome: "User 2",
      email: "user2@test.com",
      ativo: true,
    });
    const contact3 = await createTestContact({
      nome: "User 3",
      email: "user3@test.com",
      ativo: true,
    });

    // Delete contact1
    await supertest(app.server).delete(`/contacts/${contact1.id}`).expect(200);

    // Delete contact3
    await supertest(app.server).delete(`/contacts/${contact3.id}`).expect(200);

    // Verify states
    const allContacts = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, contact1.id))
      .union(testDb.select().from(contatos).where(eq(contatos.id, contact2.id)))
      .union(
        testDb.select().from(contatos).where(eq(contatos.id, contact3.id))
      );

    const contactStates = allContacts.reduce((acc, contact) => {
      acc[contact.id] = contact.ativo;
      return acc;
    }, {} as Record<string, boolean>);

    expect(contactStates[contact1.id]).toBe(false); // Deleted
    expect(contactStates[contact2.id]).toBe(true); // Still active
    expect(contactStates[contact3.id]).toBe(false); // Deleted
  });

  it("should return proper error for malformed UUID", async () => {
    const malformedUUIDs = [
      "123",
      "not-a-uuid",
      "123e4567-e89b-12d3-a456", // Too short
      "123e4567-e89b-12d3-a456-426614174000-extra", // Too long
      "123e4567-e89b-12d3-a456-426614174000g", // Invalid character
    ];

    for (const invalidId of malformedUUIDs) {
      const response = await supertest(app.server)
        .delete(`/contacts/${invalidId}`)
        .expect(400);

      expect(response.body).toMatchObject({
        message: expect.stringContaining("Invalid contact ID format"),
      });
    }
  });
});
