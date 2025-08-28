import { beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

// Setup test database connection
const client = new Client({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost:5432/test_db",
});

export const testDb = drizzle(client, {
  logger: false,
});

beforeAll(async () => {
  // Connect to database
  await client.connect();

  // Run migrations for test database
  await migrate(testDb, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  // Clean up database before each test
  // Use TRUNCATE for faster cleanup and to reset sequences
  await client.query(
    "TRUNCATE TABLE telefones, contatos RESTART IDENTITY CASCADE"
  );
});

afterAll(async () => {
  // Clean up after all tests
  await client.query(
    "TRUNCATE TABLE telefones, contatos RESTART IDENTITY CASCADE"
  );

  // Close database connection
  await client.end();
});
