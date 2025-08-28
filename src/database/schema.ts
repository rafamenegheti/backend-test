import { relations } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const contatos = pgTable("contatos", {
  id: uuid().primaryKey().defaultRandom(),
  nome: text().notNull(),
  email: text().notNull().unique(),
  codigoZip: text().notNull(),
  endereco: text().notNull(),
  numero: text().notNull(),
  bairro: text().notNull(),
  cidade: text().notNull(),
  estado: text().notNull(),
  complemento: text(),
  ativo: boolean().notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const telefones = pgTable("telefones", {
  id: uuid().primaryKey().defaultRandom(),
  numero: text().notNull(),
  contatoId: uuid()
    .notNull()
    .references(() => contatos.id, { onDelete: "cascade" }),
});

export const contatoRelations = relations(contatos, ({ many }) => ({
  telefones: many(telefones),
}));

export const telefoneRelations = relations(telefones, ({ one }) => ({
  contato: one(contatos, {
    fields: [telefones.contatoId],
    references: [contatos.id],
  }),
}));
