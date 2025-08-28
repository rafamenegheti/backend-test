import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import {
  createTestApp,
  createTestContact,
  createTestPhone,
  clearDatabase,
} from "../../utils";

describe("GET /contacts", () => {
  let app: any;

  beforeEach(async () => {
    await clearDatabase();
    app = await createTestApp();
  });

  it("should list all active contacts with pagination", async () => {
    // Create test contacts
    const contact1 = await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
      cidade: "São Paulo",
    });
    const contact2 = await createTestContact({
      nome: "Maria Santos",
      email: "maria@test.com",
      cidade: "Rio de Janeiro",
    });

    // Add phone numbers
    await createTestPhone(contact1.id, "11987654321");
    await createTestPhone(contact1.id, "11933334444");
    await createTestPhone(contact2.id, "21987654321");

    const response = await supertest(app.server).get("/contacts").expect(200);

    expect(response.body).toMatchObject({
      contacts: expect.arrayContaining([
        expect.objectContaining({
          id: contact1.id,
          nome: "João Silva",
          email: "joao@test.com",
          ativo: true,
          telefones: expect.arrayContaining([
            expect.objectContaining({ numero: "11987654321" }),
            expect.objectContaining({ numero: "11933334444" }),
          ]),
        }),
        expect.objectContaining({
          id: contact2.id,
          nome: "Maria Santos",
          email: "maria@test.com",
          ativo: true,
          telefones: expect.arrayContaining([
            expect.objectContaining({ numero: "21987654321" }),
          ]),
        }),
      ]),
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 2,
        itemsPerPage: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  });

  it("should not list inactive contacts by default", async () => {
    // Create active and inactive contacts
    const activeContact = await createTestContact({
      nome: "Active User",
      email: "active@test.com",
      ativo: true,
    });
    const inactiveContact = await createTestContact({
      nome: "Inactive User",
      email: "inactive@test.com",
      ativo: false,
    });

    const response = await supertest(app.server).get("/contacts").expect(200);

    expect(response.body.contacts).toHaveLength(1);
    expect(response.body.contacts[0]).toMatchObject({
      id: activeContact.id,
      nome: "Active User",
      ativo: true,
    });

    // Should not include inactive contact
    expect(
      response.body.contacts.find((c: any) => c.id === inactiveContact.id)
    ).toBeUndefined();
  });

  it("should list inactive contacts when ativo=false", async () => {
    // Create active and inactive contacts
    await createTestContact({
      nome: "Active User",
      email: "active@test.com",
      ativo: true,
    });
    const inactiveContact = await createTestContact({
      nome: "Inactive User",
      email: "inactive@test.com",
      ativo: false,
    });

    const response = await supertest(app.server)
      .get("/contacts?ativo=false")
      .expect(200);

    expect(response.body.contacts).toHaveLength(1);
    expect(response.body.contacts[0]).toMatchObject({
      id: inactiveContact.id,
      nome: "Inactive User",
      ativo: false,
    });
  });

  it("should search contacts by name", async () => {
    await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
    });
    await createTestContact({
      nome: "Maria Santos",
      email: "maria@test.com",
    });
    await createTestContact({
      nome: "Pedro João",
      email: "pedro@test.com",
    });

    const response = await supertest(app.server)
      .get("/contacts?search=João")
      .expect(200);

    expect(response.body.contacts).toHaveLength(2);
    expect(
      response.body.contacts.every((c: any) => c.nome.includes("João"))
    ).toBe(true);
  });

  it("should search contacts by email", async () => {
    await createTestContact({
      nome: "João Silva",
      email: "joao.silva@gmail.com",
    });
    await createTestContact({
      nome: "Maria Santos",
      email: "maria@yahoo.com",
    });

    const response = await supertest(app.server)
      .get("/contacts?search=gmail")
      .expect(200);

    expect(response.body.contacts).toHaveLength(1);
    expect(response.body.contacts[0].email).toContain("gmail");
  });

  it("should search contacts by address fields", async () => {
    await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
      endereco: "Rua das Flores",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
    });
    await createTestContact({
      nome: "Maria Santos",
      email: "maria@test.com",
      endereco: "Av. Paulista",
      bairro: "Bela Vista",
      cidade: "Rio de Janeiro",
      estado: "RJ",
    });

    // Search by address
    let response = await supertest(app.server)
      .get("/contacts?search=Flores")
      .expect(200);

    expect(response.body.contacts).toHaveLength(1);
    expect(response.body.contacts[0].endereco).toContain("Flores");

    // Search by neighborhood
    response = await supertest(app.server)
      .get("/contacts?search=Centro")
      .expect(200);

    expect(response.body.contacts).toHaveLength(1);
    expect(response.body.contacts[0].bairro).toContain("Centro");

    // Search by city
    response = await supertest(app.server)
      .get("/contacts?search=São Paulo")
      .expect(200);

    expect(response.body.contacts).toHaveLength(1);
    expect(response.body.contacts[0].cidade).toContain("São Paulo");

    // Search by state
    response = await supertest(app.server)
      .get("/contacts?search=SP")
      .expect(200);

    expect(response.body.contacts).toHaveLength(1);
    expect(response.body.contacts[0].estado).toContain("SP");
  });

  it("should search contacts by phone number", async () => {
    const contact1 = await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
    });
    const contact2 = await createTestContact({
      nome: "Maria Santos",
      email: "maria@test.com",
    });

    await createTestPhone(contact1.id, "11987654321");
    await createTestPhone(contact2.id, "21999888777");

    const response = await supertest(app.server)
      .get("/contacts?search=11987")
      .expect(200);

    expect(response.body.contacts).toHaveLength(1);
    expect(response.body.contacts[0].id).toBe(contact1.id);
    expect(
      response.body.contacts[0].telefones.some((t: any) =>
        t.numero.includes("11987")
      )
    ).toBe(true);
  });

  it("should search contacts by ZIP code", async () => {
    await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
      codigoZip: "01234567",
    });
    await createTestContact({
      nome: "Maria Santos",
      email: "maria@test.com",
      codigoZip: "98765432",
    });

    const response = await supertest(app.server)
      .get("/contacts?search=01234")
      .expect(200);

    expect(response.body.contacts).toHaveLength(1);
    expect(response.body.contacts[0].codigoZip).toContain("01234");
  });

  it("should combine search with ativo filter", async () => {
    await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
      ativo: true,
    });
    await createTestContact({
      nome: "João Santos",
      email: "joao.santos@test.com",
      ativo: false,
    });

    const response = await supertest(app.server)
      .get("/contacts?search=João&ativo=false")
      .expect(200);

    expect(response.body.contacts).toHaveLength(1);
    expect(response.body.contacts[0]).toMatchObject({
      nome: "João Santos",
      ativo: false,
    });
  });

  it("should implement pagination correctly", async () => {
    // Create 15 contacts
    for (let i = 1; i <= 15; i++) {
      await createTestContact({
        nome: `Contact ${i.toString().padStart(2, "0")}`,
        email: `contact${i}@test.com`,
      });
    }

    // Test first page with limit 5
    let response = await supertest(app.server)
      .get("/contacts?limit=5&page=1")
      .expect(200);

    expect(response.body.contacts).toHaveLength(5);
    expect(response.body.pagination).toMatchObject({
      currentPage: 1,
      totalPages: 3,
      totalItems: 15,
      itemsPerPage: 5,
      hasNextPage: true,
      hasPrevPage: false,
    });

    // Test second page
    response = await supertest(app.server)
      .get("/contacts?limit=5&page=2")
      .expect(200);

    expect(response.body.contacts).toHaveLength(5);
    expect(response.body.pagination).toMatchObject({
      currentPage: 2,
      totalPages: 3,
      totalItems: 15,
      itemsPerPage: 5,
      hasNextPage: true,
      hasPrevPage: true,
    });

    // Test last page
    response = await supertest(app.server)
      .get("/contacts?limit=5&page=3")
      .expect(200);

    expect(response.body.contacts).toHaveLength(5);
    expect(response.body.pagination).toMatchObject({
      currentPage: 3,
      totalPages: 3,
      totalItems: 15,
      itemsPerPage: 5,
      hasNextPage: false,
      hasPrevPage: true,
    });
  });

  it("should limit page size to maximum of 100", async () => {
    // Create 10 contacts
    for (let i = 1; i <= 10; i++) {
      await createTestContact({
        nome: `Contact ${i}`,
        email: `contact${i}@test.com`,
      });
    }

    const response = await supertest(app.server)
      .get("/contacts?limit=150") // Request more than 100
      .expect(200);

    expect(response.body.pagination.itemsPerPage).toBe(100); // Should be limited to 100
  });

  it("should return empty list when no contacts match search", async () => {
    await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
    });

    const response = await supertest(app.server)
      .get("/contacts?search=nonexistent")
      .expect(200);

    expect(response.body.contacts).toHaveLength(0);
    expect(response.body.pagination).toMatchObject({
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      itemsPerPage: 10,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it("should return empty list when requesting page beyond available pages", async () => {
    await createTestContact({
      nome: "João Silva",
      email: "joao@test.com",
    });

    const response = await supertest(app.server)
      .get("/contacts?page=999")
      .expect(200);

    expect(response.body.contacts).toHaveLength(0);
    expect(response.body.pagination).toMatchObject({
      currentPage: 999,
      totalPages: 1,
      totalItems: 1,
      itemsPerPage: 10,
      hasNextPage: false,
      hasPrevPage: true,
    });
  });

  it("should use default pagination when no params provided", async () => {
    // Create 5 contacts
    for (let i = 1; i <= 5; i++) {
      await createTestContact({
        nome: `Contact ${i}`,
        email: `contact${i}@test.com`,
      });
    }

    const response = await supertest(app.server).get("/contacts").expect(200);

    expect(response.body.pagination).toMatchObject({
      currentPage: 1,
      totalPages: 1,
      totalItems: 5,
      itemsPerPage: 10, // Default limit
      hasNextPage: false,
      hasPrevPage: false,
    });
  });
});
