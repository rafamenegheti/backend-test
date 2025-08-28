import { describe, it, expect, beforeEach, vi } from "vitest";
import supertest from "supertest";
import { server } from "../../app";

// Mock fetch for weather API
global.fetch = vi.fn();

// Mock the database client
vi.mock("../../database/client.ts", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            nome: "João Silva",
            email: "joao@test.com",
            ativo: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      }),
    }),
    transaction: vi.fn().mockImplementation(async (callback) => {
      return callback({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "550e8400-e29b-41d4-a716-446655440000",
              },
            ]),
          }),
        }),
      });
    }),
  },
}));

describe("POST /contacts - Unit Tests", () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = server;
    await app.ready();
  });

  it("should create a contact with valid data", async () => {
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

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(201);

    expect(response.body).toMatchObject({
      contactId: expect.any(String),
    });
  });

  it("should create a contact with phone numbers", async () => {
    const contactData = {
      nome: "João Silva",
      email: "joao@test.com",
      codigoZip: "12345678",
      endereco: "Rua das Flores",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      telefones: [{ numero: "11987654321" }, { numero: "11933334444" }],
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(201);

    expect(response.body).toMatchObject({
      contactId: expect.any(String),
    });
  });

  it("should return 400 for missing required fields", async () => {
    const incompleteData = {
      nome: "João",
      email: "joao@email.com",
      // Missing required fields
    };

    const response = await supertest(app.server)
      .post("/contacts")
      .send(incompleteData)
      .expect(400);

    expect(response.body.message).toContain("Invalid input");
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

    expect(response.body.message).toContain("email");
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

    expect(response.body.message).toContain("nome");
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

    expect(response.body.message).toContain("telefone");
  });

  it("should simulate duplicate email error", async () => {
    // Mock database to throw duplicate error
    const mockDb = await import("../../database/client.ts");
    vi.mocked(mockDb.db.transaction).mockRejectedValueOnce({
      cause: {
        code: "23505",
        constraint: "contatos_email_unique",
      },
    });

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

    const response = await supertest(app.server)
      .post("/contacts")
      .send(contactData)
      .expect(409);

    expect(response.body).toMatchObject({
      error: "DUPLICATE_EMAIL",
      message: "Este email já está cadastrado",
    });
  });
});
