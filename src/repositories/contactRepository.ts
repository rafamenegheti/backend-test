import { db } from "../database/client.ts";
import { contatos, telefones } from "../database/schema.ts";
import { and, eq, ilike, or, sql, SQL } from "drizzle-orm";

export interface CreateContactInput {
  nome: string;
  email: string;
  codigoZip: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  complemento?: string | null;
  telefones?: Array<{ numero: string }>;
}

export interface UpdateContactInput {
  nome?: string;
  email?: string;
  codigoZip?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  complemento?: string | null;
  addPhoneNumbers?: Array<{ numero: string }>;
  deletePhoneNumbers?: string[];
}

export interface ContactRepository {
  create(input: CreateContactInput): Promise<{ id: string }>;
  findById(id: string): Promise<any | null>;
  list(params: {
    search?: string;
    ativo?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ items: any[]; totalItems: number }>;
  update(id: string, input: UpdateContactInput): Promise<boolean>;
  softDelete(id: string): Promise<boolean>;
  existsByEmail(email: string): Promise<boolean>;
}

export class DrizzleContactRepository implements ContactRepository {
  async create(input: CreateContactInput): Promise<{ id: string }> {
    const { telefones: phoneNumbers, ...contactData } = input;
    const newContact = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(contatos)
        .values(contactData)
        .returning();

      if (phoneNumbers && phoneNumbers.length > 0) {
        await tx.insert(telefones).values(
          phoneNumbers.map((p) => ({
            numero: p.numero,
            contatoId: inserted.id,
          }))
        );
      }

      return inserted;
    });
    return { id: newContact.id };
  }

  async findById(id: string): Promise<any | null> {
    const rows = await db
      .select({
        id: contatos.id,
        nome: contatos.nome,
        email: contatos.email,
        codigoZip: contatos.codigoZip,
        endereco: contatos.endereco,
        numero: contatos.numero,
        bairro: contatos.bairro,
        cidade: contatos.cidade,
        estado: contatos.estado,
        complemento: contatos.complemento,
        ativo: contatos.ativo,
        createdAt: contatos.createdAt,
        updatedAt: contatos.updatedAt,
      })
      .from(contatos)
      .where(eq(contatos.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    return rows[0];
  }

  async list(params: {
    search?: string;
    ativo?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ items: any[]; totalItems: number }> {
    const { search, ativo, limit, offset } = params;
    const conditions: SQL<unknown>[] = [];

    if (typeof ativo === "boolean") {
      conditions.push(eq(contatos.ativo, ativo));
    }

    if (search) {
      const searchPattern = `%${search}%`;

      const contactsWithMatchingPhones = await db
        .select({ contatoId: telefones.contatoId })
        .from(telefones)
        .where(ilike(telefones.numero, searchPattern));

      const phoneMatchingIds = contactsWithMatchingPhones.map(
        (p) => p.contatoId
      );

      const contactSearchConditions = [
        ilike(contatos.nome, searchPattern),
        ilike(contatos.email, searchPattern),
        ilike(contatos.endereco, searchPattern),
        ilike(contatos.bairro, searchPattern),
        ilike(contatos.cidade, searchPattern),
        ilike(contatos.estado, searchPattern),
        ilike(contatos.codigoZip, searchPattern),
      ];

      contactSearchConditions.push(ilike(contatos.complemento, searchPattern));

      if (phoneMatchingIds.length > 0) {
        contactSearchConditions.push(
          sql`${contatos.id} IN (${sql.join(
            phoneMatchingIds.map((id) => sql`${id}`),
            sql`,`
          )})`
        );
      }

      const orCondition = or(...contactSearchConditions);
      if (orCondition) conditions.push(orCondition);
    }

    const baseQuery = db
      .select({
        id: contatos.id,
        nome: contatos.nome,
        email: contatos.email,
        codigoZip: contatos.codigoZip,
        endereco: contatos.endereco,
        numero: contatos.numero,
        bairro: contatos.bairro,
        cidade: contatos.cidade,
        estado: contatos.estado,
        complemento: contatos.complemento,
        ativo: contatos.ativo,
        createdAt: contatos.createdAt,
        updatedAt: contatos.updatedAt,
      })
      .from(contatos);

    const query =
      conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    const baseCountQuery = db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(contatos);
    const countQuery =
      conditions.length > 0
        ? baseCountQuery.where(and(...conditions))
        : baseCountQuery;
    const [{ count: totalItems }] = await countQuery;

    const items = await query
      .orderBy(contatos.createdAt)
      .limit(limit)
      .offset(offset);

    return { items, totalItems };
  }

  async update(id: string, input: UpdateContactInput): Promise<boolean> {
    const { addPhoneNumbers, deletePhoneNumbers, ...contactData } = input;

    const updated = await db
      .update(contatos)
      .set({ ...contactData, updatedAt: new Date() })
      .where(eq(contatos.id, id))
      .returning({ id: contatos.id });

    if (updated.length === 0) return false;

    if (deletePhoneNumbers && deletePhoneNumbers.length > 0) {
      const ownership = await db
        .select({ id: telefones.id })
        .from(telefones)
        .where(eq(telefones.contatoId, id));
      const validPhoneIds = ownership.map((p) => p.id);
      const toDelete = deletePhoneNumbers.filter((pid) =>
        validPhoneIds.includes(pid)
      );
      for (const phoneId of toDelete) {
        await db.delete(telefones).where(eq(telefones.id, phoneId));
      }
    }

    if (addPhoneNumbers && addPhoneNumbers.length > 0) {
      await db
        .insert(telefones)
        .values(
          addPhoneNumbers.map((p) => ({ numero: p.numero, contatoId: id }))
        );
    }

    return true;
  }

  async softDelete(id: string): Promise<boolean> {
    const updated = await db
      .update(contatos)
      .set({ ativo: false, updatedAt: new Date() })
      .where(eq(contatos.id, id))
      .returning({ id: contatos.id });
    return updated.length > 0;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const rows = await db
      .select({ id: contatos.id })
      .from(contatos)
      .where(eq(contatos.email, email))
      .limit(1);
    return rows.length > 0;
  }
}
