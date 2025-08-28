import { FastifyInstance } from "fastify";
import { server } from "../app";
import { testDb } from "./setup";
import { contatos, telefones } from "../database/schema";
import { fakerPT_BR as faker } from "@faker-js/faker";

export async function createTestApp(): Promise<FastifyInstance> {
  const app = server;
  await app.ready();
  return app;
}

export async function createTestContact(
  overrides: Partial<typeof contatos.$inferInsert> = {}
) {
  const timestamp = Date.now();
  const performanceNow = performance.now();
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const testId = Math.random().toString(36).substring(2, 15);
  const processId = process.pid;

  const contactData = {
    nome: overrides.nome || `${faker.person.fullName()} ${timestamp}-${testId}`,
    email:
      overrides.email ||
      `test-${timestamp}-${performanceNow.toFixed(
        3
      )}-${randomSuffix}-${processId}-${testId}@example.com`,
    codigoZip: faker.location.zipCode(),
    endereco: faker.location.streetAddress(),
    numero: faker.location.buildingNumber(),
    bairro: faker.location.street(),
    cidade: faker.location.city(),
    estado: faker.location.state(),
    complemento: faker.location.secondaryAddress(),
    ...overrides,
  };

  const [contact] = await testDb
    .insert(contatos)
    .values(contactData)
    .returning();
  return contact;
}

export async function createTestPhone(contatoId: string, numero?: string) {
  const phoneData = {
    numero: numero || faker.phone.number(),
    contatoId,
  };

  const [phone] = await testDb.insert(telefones).values(phoneData).returning();
  return phone;
}

export async function clearDatabase() {
  // Use direct client for TRUNCATE to avoid deadlocks
  const { Client } = await import("pg");
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL || "postgresql://localhost:5432/test_db",
  });
  await client.connect();
  await client.query(
    "TRUNCATE TABLE telefones, contatos RESTART IDENTITY CASCADE"
  );
  await client.end();
}

export const mockWeatherAPI = {
  success: {
    by: "default",
    valid_key: true,
    results: {
      temp: 25,
      date: "2024-01-01",
      time: "10:00",
      condition_code: "27",
      description: "Tempo limpo",
      currently: "Ensolarado",
      cid: "",
      city: "São Paulo",
      img_id: "27",
      humidity: 65,
      cloudiness: 10,
      rain: 0,
      wind_speedy: "10 km/h",
      wind_direction: 90,
      wind_cardinal: "L",
      sunrise: "06:00",
      sunset: "18:00",
      moon_phase: "full",
    },
  },
  error: {
    valid_key: false,
    results: null,
  },
  rainy: {
    by: "default",
    valid_key: true,
    results: {
      temp: 20,
      date: "2024-01-01",
      time: "10:00",
      condition_code: "8",
      description: "Chuva",
      currently: "Chuvoso",
      cid: "",
      city: "São Paulo",
      img_id: "8",
      humidity: 85,
      cloudiness: 90,
      rain: 10,
      wind_speedy: "15 km/h",
      wind_direction: 180,
      wind_cardinal: "S",
      sunrise: "06:00",
      sunset: "18:00",
      moon_phase: "new",
    },
  },
  cold: {
    by: "default",
    valid_key: true,
    results: {
      temp: 15,
      date: "2024-01-01",
      time: "10:00",
      condition_code: "27",
      description: "Tempo limpo",
      currently: "Ensolarado",
      cid: "",
      city: "São Paulo",
      img_id: "27",
      humidity: 55,
      cloudiness: 5,
      rain: 0,
      wind_speedy: "5 km/h",
      wind_direction: 45,
      wind_cardinal: "NE",
      sunrise: "06:00",
      sunset: "18:00",
      moon_phase: "waning",
    },
  },
  hot: {
    by: "default",
    valid_key: true,
    results: {
      temp: 35,
      date: "2024-01-01",
      time: "10:00",
      condition_code: "27",
      description: "Tempo limpo",
      currently: "Ensolarado",
      cid: "",
      city: "São Paulo",
      img_id: "27",
      humidity: 40,
      cloudiness: 0,
      rain: 0,
      wind_speedy: "20 km/h",
      wind_direction: 270,
      wind_cardinal: "O",
      sunrise: "06:00",
      sunset: "18:00",
      moon_phase: "full",
    },
  },
};
