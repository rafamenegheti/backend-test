import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestContact,
  createTestPhone,
  clearDatabase,
  mockWeatherAPI,
} from "./utils";
import { testDb } from "./setup";
import { contatos, telefones } from "../database/schema";
import { eq } from "drizzle-orm";

describe("Test Utils", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("createTestContact", () => {
    it("should create a contact with default faker data", async () => {
      const contact = await createTestContact();

      expect(contact).toMatchObject({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        ),
        nome: expect.any(String),
        email: expect.any(String),
        codigoZip: expect.any(String),
        endereco: expect.any(String),
        numero: expect.any(String),
        bairro: expect.any(String),
        cidade: expect.any(String),
        estado: expect.any(String),
        complemento: expect.any(String),
        ativo: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      // Verify it was actually saved in database
      const savedContact = await testDb
        .select()
        .from(contatos)
        .where(eq(contatos.id, contact.id));

      expect(savedContact).toHaveLength(1);
      expect(savedContact[0]).toEqual(contact);
    });

    it("should create a contact with custom overrides", async () => {
      const customData = {
        nome: "Custom Name",
        email: "custom@test.com",
        cidade: "Custom City",
        ativo: false,
      };

      const contact = await createTestContact(customData);

      expect(contact).toMatchObject(customData);
      expect(contact.nome).toBe("Custom Name");
      expect(contact.email).toBe("custom@test.com");
      expect(contact.cidade).toBe("Custom City");
      expect(contact.ativo).toBe(false);
    });

    it("should create multiple unique contacts", async () => {
      const contact1 = await createTestContact({ nome: "Contact 1" });
      const contact2 = await createTestContact({ nome: "Contact 2" });

      expect(contact1.id).not.toBe(contact2.id);
      expect(contact1.email).not.toBe(contact2.email);
      expect(contact1.nome).toBe("Contact 1");
      expect(contact2.nome).toBe("Contact 2");

      // Verify both are in database
      const allContacts = await testDb.select().from(contatos);
      expect(allContacts).toHaveLength(2);
    });
  });

  describe("createTestPhone", () => {
    it("should create a phone with default faker data", async () => {
      const contact = await createTestContact();
      const phone = await createTestPhone(contact.id);

      expect(phone).toMatchObject({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        ),
        numero: expect.any(String),
        contatoId: contact.id,
      });

      // Verify it was actually saved in database
      const savedPhone = await testDb
        .select()
        .from(telefones)
        .where(eq(telefones.id, phone.id));

      expect(savedPhone).toHaveLength(1);
      expect(savedPhone[0]).toEqual(phone);
    });

    it("should create a phone with custom number", async () => {
      const contact = await createTestContact();
      const customNumber = "11987654321";
      const phone = await createTestPhone(contact.id, customNumber);

      expect(phone.numero).toBe(customNumber);
      expect(phone.contatoId).toBe(contact.id);
    });

    it("should create multiple phones for same contact", async () => {
      const contact = await createTestContact();

      const phone1 = await createTestPhone(contact.id, "11111111111");
      const phone2 = await createTestPhone(contact.id, "22222222222");
      const phone3 = await createTestPhone(contact.id, "33333333333");

      expect([phone1.id, phone2.id, phone3.id]).toHaveLength(3);
      expect(new Set([phone1.id, phone2.id, phone3.id])).toHaveLength(3); // All unique

      // Verify all are linked to the same contact
      expect(phone1.contatoId).toBe(contact.id);
      expect(phone2.contatoId).toBe(contact.id);
      expect(phone3.contatoId).toBe(contact.id);

      // Verify all are in database
      const contactPhones = await testDb
        .select()
        .from(telefones)
        .where(eq(telefones.contatoId, contact.id));

      expect(contactPhones).toHaveLength(3);
      expect(contactPhones.map((p) => p.numero)).toEqual(
        expect.arrayContaining(["11111111111", "22222222222", "33333333333"])
      );
    });

    it("should fail when creating phone for non-existent contact", async () => {
      const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";

      await expect(
        createTestPhone(nonExistentId, "11987654321")
      ).rejects.toThrow();
    });
  });

  describe("clearDatabase", () => {
    it("should remove all contacts and phones", async () => {
      // Create test data
      const contact1 = await createTestContact();
      const contact2 = await createTestContact();
      await createTestPhone(contact1.id);
      await createTestPhone(contact1.id);
      await createTestPhone(contact2.id);

      // Verify data exists
      const contactsBefore = await testDb.select().from(contatos);
      const phonesBefore = await testDb.select().from(telefones);
      expect(contactsBefore).toHaveLength(2);
      expect(phonesBefore).toHaveLength(3);

      // Clear database
      await clearDatabase();

      // Verify data is gone
      const contactsAfter = await testDb.select().from(contatos);
      const phonesAfter = await testDb.select().from(telefones);
      expect(contactsAfter).toHaveLength(0);
      expect(phonesAfter).toHaveLength(0);
    });

    it("should handle empty database gracefully", async () => {
      // Clear already empty database
      await clearDatabase();

      const contacts = await testDb.select().from(contatos);
      const phones = await testDb.select().from(telefones);
      expect(contacts).toHaveLength(0);
      expect(phones).toHaveLength(0);

      // Should not throw error
      await expect(clearDatabase()).resolves.not.toThrow();
    });
  });

  describe("mockWeatherAPI", () => {
    it("should have success mock with correct structure", () => {
      expect(mockWeatherAPI.success).toMatchObject({
        by: expect.any(String),
        valid_key: true,
        results: {
          temp: expect.any(Number),
          date: expect.any(String),
          time: expect.any(String),
          condition_code: expect.any(String),
          description: expect.any(String),
          currently: expect.any(String),
          cid: expect.any(String),
          city: expect.any(String),
          img_id: expect.any(String),
          humidity: expect.any(Number),
          cloudiness: expect.any(Number),
          rain: expect.any(Number),
          wind_speedy: expect.any(String),
          wind_direction: expect.any(Number),
          wind_cardinal: expect.any(String),
          sunrise: expect.any(String),
          sunset: expect.any(String),
          moon_phase: expect.any(String),
        },
      });
    });

    it("should have error mock with correct structure", () => {
      expect(mockWeatherAPI.error).toMatchObject({
        valid_key: false,
        results: null,
      });
    });

    it("should have different weather scenarios", () => {
      expect(mockWeatherAPI.success.results.temp).toBe(25);
      expect(mockWeatherAPI.rainy.results.temp).toBe(20);
      expect(mockWeatherAPI.cold.results.temp).toBe(15);
      expect(mockWeatherAPI.hot.results.temp).toBe(35);

      expect(mockWeatherAPI.rainy.results.description).toBe("Chuva");
      expect(mockWeatherAPI.cold.results.description).toBe("Tempo limpo");
      expect(mockWeatherAPI.hot.results.description).toBe("Tempo limpo");
    });

    it("should have consistent city name across scenarios", () => {
      const scenarios = [
        mockWeatherAPI.success,
        mockWeatherAPI.rainy,
        mockWeatherAPI.cold,
        mockWeatherAPI.hot,
      ];

      scenarios.forEach((scenario) => {
        expect(scenario.results.city).toBe("São Paulo");
      });
    });

    it("should have valid condition codes", () => {
      expect(mockWeatherAPI.success.results.condition_code).toBe("27");
      expect(mockWeatherAPI.rainy.results.condition_code).toBe("8");
      expect(mockWeatherAPI.cold.results.condition_code).toBe("27");
      expect(mockWeatherAPI.hot.results.condition_code).toBe("27");
    });

    it("should have appropriate weather descriptions for conditions", () => {
      expect(mockWeatherAPI.success.results.currently).toBe("Ensolarado");
      expect(mockWeatherAPI.rainy.results.currently).toBe("Chuvoso");
      expect(mockWeatherAPI.cold.results.currently).toBe("Ensolarado");
      expect(mockWeatherAPI.hot.results.currently).toBe("Ensolarado");
    });

    it("should have realistic weather data ranges", () => {
      const scenarios = [
        mockWeatherAPI.success,
        mockWeatherAPI.rainy,
        mockWeatherAPI.cold,
        mockWeatherAPI.hot,
      ];

      scenarios.forEach((scenario) => {
        const { results } = scenario;
        expect(results.temp).toBeGreaterThanOrEqual(-50);
        expect(results.temp).toBeLessThanOrEqual(60);
        expect(results.humidity).toBeGreaterThanOrEqual(0);
        expect(results.humidity).toBeLessThanOrEqual(100);
        expect(results.cloudiness).toBeGreaterThanOrEqual(0);
        expect(results.cloudiness).toBeLessThanOrEqual(100);
        expect(results.rain).toBeGreaterThanOrEqual(0);
        expect(results.wind_direction).toBeGreaterThanOrEqual(0);
        expect(results.wind_direction).toBeLessThanOrEqual(360);
      });
    });
  });
});
