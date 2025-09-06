import { db } from "../database/client.ts";
import { contatos, telefones } from "../database/schema.ts";
import { and, eq, ilike, or, sql, SQL, inArray } from "drizzle-orm";

export type ContactRow = typeof contatos.$inferSelect;
type ContactInsert = typeof contatos.$inferInsert;

export type CreateContactInput = ContactInsert & {
  telefones?: Array<{ numero: string }>;
};

export type UpdateContactInput = Partial<ContactInsert> & {
  addPhoneNumbers?: Array<{ numero: string }>;
  deletePhoneNumbers?: string[];
};

export interface ContactRepository {
  create(input: CreateContactInput): Promise<{ id: string }>;
  findById(
    id: string
  ): Promise<
    (ContactRow & { telefones: Array<{ id: string; numero: string }> }) | null
  >;
  list(params: {
    search?: string;
    ativo?: boolean;
    limit: number;
    offset: number;
  }): Promise<{
    items: (ContactRow & {
      telefones: Array<{ id: string; numero: string }>;
    })[];
    totalItems: number;
  }>;
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

  async findById(
    id: string
  ): Promise<
    (ContactRow & { telefones: Array<{ id: string; numero: string }> }) | null
  > {
    const result = await db.query.contatos.findFirst({
      where: eq(contatos.id, id),
      with: { telefones: true },
    });

    if (!result) return null;

    return {
      ...result,
    };
  }

  async list(params: {
    search?: string;
    ativo?: boolean;
    limit: number;
    offset: number;
  }): Promise<{
    items: (ContactRow & {
      telefones: Array<{ id: string; numero: string }>;
    })[];
    totalItems: number;
  }> {
    const { search, ativo, limit, offset } = params;
    const conditions: SQL<unknown>[] = [];

    if (typeof ativo === "boolean") {
      conditions.push(eq(contatos.ativo, ativo));
    }

    if (search) {
      const searchPattern = `%${search}%`;
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

      contactSearchConditions.push(
        sql`exists (select 1 from ${telefones} where ${telefones.contatoId} = ${contatos.id} and ${telefones.numero} ilike ${searchPattern})`
      );

      const orCondition = or(...contactSearchConditions);
      if (orCondition) conditions.push(orCondition);
    }

    const baseCountQuery = db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(contatos);

    const countQuery =
      conditions.length > 0
        ? baseCountQuery.where(and(...conditions))
        : baseCountQuery;

    const [{ count: totalItems }] = await countQuery;

    // Fetch filtered IDs with the same conditions to preserve pagination
    const idQuery = db
      .select({ id: contatos.id })
      .from(contatos)
      .orderBy(contatos.createdAt)
      .limit(limit)
      .offset(offset);
    const filteredIds =
      conditions.length > 0
        ? await idQuery.where(and(...conditions))
        : await idQuery;

    if (filteredIds.length === 0) {
      return { items: [], totalItems };
    }

    // Fetch items with nested phones
    const items = await db.query.contatos.findMany({
      with: {
        telefones: true,
      },
      where: inArray(
        contatos.id,
        filteredIds.map((r) => r.id)
      ),
      orderBy: (c, { asc }) => [asc(c.createdAt)],
    });

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
