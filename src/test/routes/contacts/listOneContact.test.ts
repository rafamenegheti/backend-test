import { describe, it, expect, beforeEach, vi } from "vitest";
import supertest from "supertest";
import {
  createTestApp,
  createTestContact,
  createTestPhone,
  clearDatabase,
  mockWeatherAPI,
} from "../../utils";
import type { FastifyInstance } from "fastify";

// Mock fetch globally
global.fetch = vi.fn();

describe("GET /contacts/:id", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await clearDatabase();
    app = await createTestApp();
    vi.clearAllMocks();
  });

  it("should get a specific contact with weather information", async () => {
    const contact = await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
      cidade: "São Paulo",
      ativo: true,
    });

    await createTestPhone(contact.id, "11987654321");
    await createTestPhone(contact.id, "11933334444");

    // Mock successful weather API response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherAPI.success,
    } as Response);

    const response = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      contact: {
        id: contact.id,
        nome: "João Silva",
        email: "joao@test.com",
        cidade: "São Paulo",
        ativo: true,
        telefones: expect.arrayContaining([
          expect.objectContaining({ numero: "11987654321" }),
          expect.objectContaining({ numero: "11933334444" }),
        ]),
        weather: {
          temp: 25,
          condition: "Tempo limpo",
          currently: "Ensolarado",
          city: "São Paulo",
          suggestion:
            "Convide seu contato para fazer alguma atividade ao ar livre",
        },
      },
    });

    // Verify weather API was called with correct city (case-insensitive)
    const calledUrl = (fetch as unknown as { mock: { calls: any[][] } }).mock
      .calls[0][0] as string;
    const cityParam = new URL(calledUrl).searchParams.get("city_name");
    expect(cityParam).toBeTruthy();
    expect(decodeURIComponent(cityParam as string).toLowerCase()).toContain(
      "são paulo"
    );
  });

  it("should return weather error when API fails", async () => {
    const contact = await createTestContact({
      nome: "Maria Santos",
      email: "maria@test.com",
      cidade: "Rio de Janeiro",
      ativo: true,
    });

    // Mock failed weather API response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const response = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body.contact.weather).toMatchObject({
      error: "WEATHER_API_ERROR",
      message: "Erro na API do tempo: 500",
    });
  });

  it("should return city not found error when weather API returns invalid data", async () => {
    const contact = await createTestContact({
      nome: "Pedro Silva",
      email: "pedro@test.com",
      cidade: "NonexistentCity",
      ativo: true,
    });

    // Mock weather API response for city not found
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherAPI.error,
    } as Response);

    const response = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body.contact.weather).toMatchObject({
      error: "CITY_NOT_FOUND",
      message: "Cidade não encontrada na API do tempo",
    });
  });

  it("should return weather service unavailable when fetch throws error", async () => {
    const contact = await createTestContact({
      nome: "Ana Silva",
      email: "ana@test.com",
      cidade: "São Paulo",
      ativo: true,
    });

    // Mock fetch to throw an error
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const response = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body.contact.weather).toMatchObject({
      error: "WEATHER_SERVICE_UNAVAILABLE",
      message: "Serviço de clima temporariamente indisponível",
    });
  });

  it("should generate correct weather suggestion for cold weather", async () => {
    const contact = await createTestContact({
      nome: "Carlos Silva",
      email: "carlos@test.com",
      cidade: "São Paulo",
      ativo: true,
    });

    // Mock cold weather response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherAPI.cold,
    } as Response);

    const response = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body.contact.weather).toMatchObject({
      temp: 15,
      suggestion: "Ofereça um chocolate quente ao seu contato...",
    });
  });

  it("should generate correct weather suggestion for hot sunny weather", async () => {
    const contact = await createTestContact({
      nome: "Laura Silva",
      email: "laura@test.com",
      cidade: "São Paulo",
      ativo: true,
    });

    // Mock hot sunny weather response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherAPI.hot,
    } as Response);

    const response = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body.contact.weather).toMatchObject({
      temp: 35,
      suggestion: "Convide seu contato para ir à praia com esse calor!",
    });
  });

  it("should generate correct weather suggestion for rainy weather", async () => {
    const contact = await createTestContact({
      nome: "Ricardo Silva",
      email: "ricardo@test.com",
      cidade: "São Paulo",
      ativo: true,
    });

    // Mock rainy weather response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherAPI.rainy,
    } as Response);

    const response = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body.contact.weather).toMatchObject({
      temp: 20,
      condition: "Chuva",
      suggestion: "Convide seu contato para ver um filme",
    });
  });

  it("should return 404 for non-existent contact", async () => {
    const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";

    const response = await supertest(app.server)
      .get(`/contacts/${nonExistentId}`)
      .expect(404);

    expect(response.body).toMatchObject({
      error: "CONTACT_NOT_FOUND",
      message: "Contato não encontrado",
    });

    // Weather API should not be called for non-existent contacts
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should return 404 for inactive contact", async () => {
    const inactiveContact = await createTestContact({
      nome: "Inactive User",
      email: "inactive@test.com",
      ativo: false,
    });

    const response = await supertest(app.server)
      .get(`/contacts/${inactiveContact.id}`)
      .expect(404);

    expect(response.body).toMatchObject({
      error: "CONTACT_NOT_FOUND",
      message: "Contato não encontrado",
    });

    // Weather API should not be called for inactive contacts
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should return 400 for invalid UUID format", async () => {
    const response = await supertest(app.server)
      .get("/contacts/invalid-uuid")
      .expect(400);

    expect(response.body).toMatchObject({
      message: expect.stringContaining("Invalid contact ID format"),
    });

    // Weather API should not be called for invalid UUIDs
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should return contact with empty telefones array when no phones exist", async () => {
    const contact = await createTestContact({
      nome: "No Phone User",
      email: "nophone@test.com",
      cidade: "São Paulo",
      ativo: true,
    });

    // Mock successful weather API response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherAPI.success,
    } as Response);

    const response = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body.contact).toMatchObject({
      id: contact.id,
      nome: "No Phone User",
      telefones: [],
    });
    expect(response.body.contact.weather).toBeDefined();
  });

  it("should include all contact fields in response", async () => {
    const contact = await createTestContact({
      nome: "Complete User",
      email: "complete@test.com",
      codigoZip: "12345678",
      endereco: "Rua Teste",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      complemento: "Apto 45",
      ativo: true,
    });

    // Mock successful weather API response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherAPI.success,
    } as Response);

    const response = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body.contact).toMatchObject({
      id: contact.id,
      nome: "Complete User",
      email: "complete@test.com",
      codigoZip: "12345678",
      endereco: "Rua Teste",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      complemento: "Apto 45",
      ativo: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      telefones: [],
      weather: expect.any(Object),
    });
  });

  it("should handle contact with null complemento", async () => {
    const contact = await createTestContact({
      nome: "No Complemento User",
      email: "nocomplemento@test.com",
      cidade: "São Paulo",
      complemento: null,
      ativo: true,
    });

    // Mock successful weather API response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherAPI.success,
    } as Response);

    const response = await supertest(app.server)
      .get(`/contacts/${contact.id}`)
      .expect(200);

    expect(response.body.contact.complemento).toBeNull();
  });
});
