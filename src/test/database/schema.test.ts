import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "../setup";
import { contatos, telefones } from "../../database/schema";
import { eq } from "drizzle-orm";
import { clearDatabase } from "../utils";

describe("Database Schema", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("contatos table", () => {
    it("should create contact with all required fields", async () => {
      const contactData = {
        nome: "João Silva",
        email: "joao@test.com",
        codigoZip: "12345678",
        endereco: "Rua das Flores",
        numero: "123",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
        complemento: "Apto 45",
      };

      const [insertedContact] = await testDb
        .insert(contatos)
        .values(contactData)
        .returning();

      expect(insertedContact).toMatchObject(contactData);
      expect(insertedContact.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(insertedContact.ativo).toBe(true); // Default value
      expect(insertedContact.createdAt).toBeInstanceOf(Date);
      expect(insertedContact.updatedAt).toBeInstanceOf(Date);
    });

    it("should create contact with minimal required fields", async () => {
      const contactData = {
        nome: "Maria Santos",
        email: "maria@test.com",
        codigoZip: "87654321",
        endereco: "Av. Paulista",
        numero: "1000",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        estado: "SP",
        // complemento is optional
      };

      const [insertedContact] = await testDb
        .insert(contatos)
        .values(contactData)
        .returning();

      expect(insertedContact).toMatchObject(contactData);
      expect(insertedContact.complemento).toBeNull();
    });

    it("should auto-generate UUID for id field", async () => {
      const contactData = {
        nome: "Pedro Silva",
        email: "pedro@test.com",
        codigoZip: "11111111",
        endereco: "Rua A",
        numero: "1",
        bairro: "B",
        cidade: "C",
        estado: "SP",
      };

      const [contact1] = await testDb
        .insert(contatos)
        .values(contactData)
        .returning();

      contactData.email = "pedro2@test.com"; // Change email to avoid unique constraint
      const [contact2] = await testDb
        .insert(contatos)
        .values(contactData)
        .returning();

      expect(contact1.id).not.toBe(contact2.id);
      expect(contact1.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(contact2.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("should enforce unique constraint on email field", async () => {
      const contactData = {
        nome: "João Silva",
        email: "joao@test.com",
        codigoZip: "12345678",
        endereco: "Rua das Flores",
        numero: "123",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
      };

      await testDb.insert(contatos).values(contactData);

      // Try to insert another contact with same email but different nome
      await expect(
        testDb.insert(contatos).values({
          ...contactData,
          nome: "Maria Silva",
        })
      ).rejects.toThrow();
    });

    it("should set default value for ativo field", async () => {
      const contactData = {
        nome: "Ana Santos",
        email: "ana@test.com",
        codigoZip: "12345678",
        endereco: "Rua das Flores",
        numero: "123",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
      };

      const [insertedContact] = await testDb
        .insert(contatos)
        .values(contactData)
        .returning();

      expect(insertedContact.ativo).toBe(true);
    });

    it("should allow explicit ativo value", async () => {
      const contactData = {
        nome: "Inactive User",
        email: "inactive@test.com",
        codigoZip: "12345678",
        endereco: "Rua das Flores",
        numero: "123",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
        ativo: false,
      };

      const [insertedContact] = await testDb
        .insert(contatos)
        .values(contactData)
        .returning();

      expect(insertedContact.ativo).toBe(false);
    });

    it("should set timestamps automatically", async () => {
      const beforeInsert = new Date();

      const contactData = {
        nome: "Timestamp Test",
        email: "timestamp@test.com",
        codigoZip: "12345678",
        endereco: "Rua das Flores",
        numero: "123",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
      };

      const [insertedContact] = await testDb
        .insert(contatos)
        .values(contactData)
        .returning();

      const afterInsert = new Date();

      expect(insertedContact.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeInsert.getTime()
      );
      expect(insertedContact.createdAt.getTime()).toBeLessThanOrEqual(
        afterInsert.getTime()
      );
      expect(insertedContact.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeInsert.getTime()
      );
      expect(insertedContact.updatedAt.getTime()).toBeLessThanOrEqual(
        afterInsert.getTime()
      );
    });

    it("should update updatedAt when record is updated", async () => {
      const [contact] = await testDb
        .insert(contatos)
        .values({
          nome: "Update Test",
          email: "update@test.com",
          codigoZip: "12345678",
          endereco: "Rua das Flores",
          numero: "123",
          bairro: "Centro",
          cidade: "São Paulo",
          estado: "SP",
        })
        .returning();

      const originalUpdatedAt = contact.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      const [updatedContact] = await testDb
        .update(contatos)
        .set({
          nome: "Updated Name",
          updatedAt: new Date(),
        })
        .where(eq(contatos.id, contact.id))
        .returning();

      expect(updatedContact.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
      expect(updatedContact.createdAt).toEqual(contact.createdAt); // Should not change
    });
  });

  describe("telefones table", () => {
    it("should create phone number with contact reference", async () => {
      // First create a contact
      const [contact] = await testDb
        .insert(contatos)
        .values({
          nome: "Phone Test User",
          email: "phonetest@test.com",
          codigoZip: "12345678",
          endereco: "Rua das Flores",
          numero: "123",
          bairro: "Centro",
          cidade: "São Paulo",
          estado: "SP",
        })
        .returning();

      const phoneData = {
        numero: "11987654321",
        contatoId: contact.id,
      };

      const [insertedPhone] = await testDb
        .insert(telefones)
        .values(phoneData)
        .returning();

      expect(insertedPhone).toMatchObject(phoneData);
      expect(insertedPhone.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("should auto-generate UUID for id field", async () => {
      // Create a contact first
      const [contact] = await testDb
        .insert(contatos)
        .values({
          nome: "Multi Phone User",
          email: "multiphone@test.com",
          codigoZip: "12345678",
          endereco: "Rua das Flores",
          numero: "123",
          bairro: "Centro",
          cidade: "São Paulo",
          estado: "SP",
        })
        .returning();

      const [phone1] = await testDb
        .insert(telefones)
        .values({ numero: "11111111111", contatoId: contact.id })
        .returning();

      const [phone2] = await testDb
        .insert(telefones)
        .values({ numero: "22222222222", contatoId: contact.id })
        .returning();

      expect(phone1.id).not.toBe(phone2.id);
      expect(phone1.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(phone2.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("should enforce foreign key constraint", async () => {
      const nonExistentContactId = "123e4567-e89b-12d3-a456-426614174000";

      await expect(
        testDb.insert(telefones).values({
          numero: "11987654321",
          contatoId: nonExistentContactId,
        })
      ).rejects.toThrow();
    });

    it("should cascade delete when contact is deleted", async () => {
      // Create contact
      const [contact] = await testDb
        .insert(contatos)
        .values({
          nome: "Cascade Test",
          email: "cascade@test.com",
          codigoZip: "12345678",
          endereco: "Rua das Flores",
          numero: "123",
          bairro: "Centro",
          cidade: "São Paulo",
          estado: "SP",
        })
        .returning();

      // Create phone numbers
      await testDb.insert(telefones).values([
        { numero: "11111111111", contatoId: contact.id },
        { numero: "22222222222", contatoId: contact.id },
      ]);

      // Verify phones exist
      const phonesBefore = await testDb
        .select()
        .from(telefones)
        .where(eq(telefones.contatoId, contact.id));

      expect(phonesBefore).toHaveLength(2);

      // Delete contact (hard delete to test cascade)
      await testDb.delete(contatos).where(eq(contatos.id, contact.id));

      // Verify phones were cascade deleted
      const phonesAfter = await testDb
        .select()
        .from(telefones)
        .where(eq(telefones.contatoId, contact.id));

      expect(phonesAfter).toHaveLength(0);
    });

    it("should allow multiple phone numbers for same contact", async () => {
      // Create contact
      const [contact] = await testDb
        .insert(contatos)
        .values({
          nome: "Multiple Phones User",
          email: "multiplephones@test.com",
          codigoZip: "12345678",
          endereco: "Rua das Flores",
          numero: "123",
          bairro: "Centro",
          cidade: "São Paulo",
          estado: "SP",
        })
        .returning();

      // Create multiple phone numbers
      const phoneNumbers = ["11987654321", "11933334444", "1134567890"];

      for (const numero of phoneNumbers) {
        await testDb.insert(telefones).values({
          numero,
          contatoId: contact.id,
        });
      }

      // Verify all phones were created
      const phones = await testDb
        .select()
        .from(telefones)
        .where(eq(telefones.contatoId, contact.id));

      expect(phones).toHaveLength(3);
      expect(phones.map((p) => p.numero)).toEqual(
        expect.arrayContaining(phoneNumbers)
      );
    });

    it("should allow duplicate phone numbers for different contacts", async () => {
      // Create two contacts
      const [contact1] = await testDb
        .insert(contatos)
        .values({
          nome: "Contact 1",
          email: "contact1@test.com",
          codigoZip: "12345678",
          endereco: "Rua A",
          numero: "1",
          bairro: "Bairro A",
          cidade: "Cidade A",
          estado: "SP",
        })
        .returning();

      const [contact2] = await testDb
        .insert(contatos)
        .values({
          nome: "Contact 2",
          email: "contact2@test.com",
          codigoZip: "87654321",
          endereco: "Rua B",
          numero: "2",
          bairro: "Bairro B",
          cidade: "Cidade B",
          estado: "RJ",
        })
        .returning();

      const samePhoneNumber = "11987654321";

      // Add same phone number to both contacts
      await testDb.insert(telefones).values({
        numero: samePhoneNumber,
        contatoId: contact1.id,
      });

      await testDb.insert(telefones).values({
        numero: samePhoneNumber,
        contatoId: contact2.id,
      });

      // Verify both phones exist
      const allPhones = await testDb.select().from(telefones);

      const phonesWithSameNumber = allPhones.filter(
        (p) => p.numero === samePhoneNumber
      );
      expect(phonesWithSameNumber).toHaveLength(2);
      expect(phonesWithSameNumber.map((p) => p.contatoId)).toEqual(
        expect.arrayContaining([contact1.id, contact2.id])
      );
    });
  });
});
