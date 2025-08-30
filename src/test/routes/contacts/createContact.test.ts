import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { createTestApp, clearDatabase } from "../../utils";
import { testDb } from "../../setup";
import { contatos, telefones } from "../../../database/schema";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

describe("POST /contacts", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await clearDatabase();
    app = await createTestApp();
  });

  it("should create a contact with all fields and phone numbers", async () => {
    const contactData = {
      nome: "João Silva",
      email: "joao.silva@email.com",
      codigoZip: "12345678",
      endereco: "Rua das Flores",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      complemento: "Apto 45",
      telefones: [{ numero: "11987654321" }, { numero: "1133334444" }],
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(201);

    expect(response.body).toMatchObject({
      contactId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      ),
    });

    // Verify contact was saved in database
    const savedContact = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, response.body.contactId));

    expect(savedContact).toHaveLength(1);
    expect(savedContact[0]).toMatchObject({
      nome: contactData.nome,
      email: contactData.email,
      codigoZip: contactData.codigoZip,
      endereco: contactData.endereco,
      numero: contactData.numero,
      bairro: contactData.bairro,
      cidade: contactData.cidade,
      estado: contactData.estado,
      complemento: contactData.complemento,
      ativo: true,
    });

    // Verify phone numbers were saved
    const savedPhones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, response.body.contactId));

    expect(savedPhones).toHaveLength(2);
    expect(savedPhones.map((p) => p.numero)).toEqual(
      expect.arrayContaining(["11987654321", "1133334444"])
    );
  });

  it("should create a contact with minimal required fields (no phone numbers)", async () => {
    const contactData = {
      nome: "Ana Silva",
      email: "ana.silva@email.com",
      codigoZip: "87654321",
      endereco: "Av. Paulista",
      numero: "1000",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      estado: "SP",
      complemento: "Torre A",
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(201);

    expect(response.body).toMatchObject({
      contactId: expect.any(String),
    });

    // Verify no phone numbers were created
    const savedPhones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, response.body.contactId));

    expect(savedPhones).toHaveLength(0);
  });

  it("should return 400 for missing required fields", async () => {
    const incompleteData = {
      nome: "João",
      email: "joao@email.com",
      // Missing required fields: codigoZip, endereco, numero, bairro, cidade, estado
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(incompleteData)
      .expect(400);

    expect(response.body).toMatchObject({
      message: expect.stringContaining("Invalid input"),
    });
  });

  it("should return 400 for invalid email format", async () => {
    const contactData = {
      nome: "João Silva",
      email: "invalid-email",
      codigoZip: "12345678",
      endereco: "Rua das Flores",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(400);

    expect(response.body).toMatchObject({
      message: expect.stringContaining("email"),
    });
  });

  it("should return 400 for nome too short", async () => {
    const contactData = {
      nome: "A", // Too short
      email: "ana@email.com",
      codigoZip: "12345678",
      endereco: "Rua das Flores",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(400);

    expect(response.body).toMatchObject({
      message: expect.stringContaining("nome"),
    });
  });

  it("should return 400 for invalid phone number", async () => {
    const contactData = {
      nome: "João Silva",
      email: "joao@email.com",
      codigoZip: "12345678",
      endereco: "Rua das Flores",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      telefones: [
        { numero: "123" }, // Too short
      ],
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(400);

    expect(response.body).toMatchObject({
      message: expect.stringContaining("telefone"),
    });
  });

  it("should return 409 for duplicate email", async () => {
    const contactData = {
      nome: "João Silva",
      email: "duplicate@email.com",
      codigoZip: "12345678",
      endereco: "Rua das Flores",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
    };

    // Create first contact
    await supertest(app.server).post("/contacts").send(contactData).expect(201);

    // Try to create second contact with same email
    const response = await supertest(app.server)
      .post("/contacts")
      .send({
        ...contactData,
        nome: "Ana Silva", // Different name, same email
      })
      .expect(409);

    expect(response.body).toMatchObject({
      error: "DUPLICATE_EMAIL",
      message: "Este email já está cadastrado",
    });
  });

  it("should return 400 for ZIP code too short", async () => {
    const contactData = {
      nome: "João Silva",
      email: "joao@email.com",
      codigoZip: "123", // Too short
      endereco: "Rua das Flores",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(400);

    expect(response.body).toMatchObject({
      message: expect.stringContaining("CEP"),
    });
  });

  it("should return 400 for estado too short", async () => {
    const contactData = {
      nome: "João Silva",
      email: "joao@email.com",
      codigoZip: "12345678",
      endereco: "Rua das Flores",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "S", // Too short
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(400);

    expect(response.body).toMatchObject({
      message: expect.stringContaining("estado"),
    });
  });

  it("should create contact without complemento (optional field)", async () => {
    const contactData = {
      nome: "Maria Santos",
      email: "maria@email.com",
      codigoZip: "12345678",
      endereco: "Rua das Palmeiras",
      numero: "456",
      bairro: "Jardins",
      cidade: "São Paulo",
      estado: "SP",
      // complemento is optional and not provided
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(201);

    expect(response.body).toMatchObject({
      contactId: expect.any(String),
    });

    // Verify contact was saved with null complemento
    const savedContact = await testDb
      .select()
      .from(contatos)
      .where(eq(contatos.id, response.body.contactId));

    expect(savedContact[0].complemento).toBeNull();
  });

  it("should create contact with empty telefones array", async () => {
    const contactData = {
      nome: "Pedro Oliveira",
      email: "pedro@email.com",
      codigoZip: "12345678",
      endereco: "Rua das Acácias",
      numero: "789",
      bairro: "Vila Madalena",
      cidade: "São Paulo",
      estado: "SP",
      telefones: [], // Empty array
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(201);

    expect(response.body).toMatchObject({
      contactId: expect.any(String),
    });

    // Verify no phone numbers were created
    const savedPhones = await testDb
      .select()
      .from(telefones)
      .where(eq(telefones.contatoId, response.body.contactId));

    expect(savedPhones).toHaveLength(0);
  });
});
