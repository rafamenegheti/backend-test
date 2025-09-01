import { db } from "./client.ts";
import { contatos, telefones } from "./schema.ts";
import { fakerPT_BR as faker } from "@faker-js/faker";

async function seed() {
  const contatosInsert = await db
    .insert(contatos)
    .values([
      {
        nome: faker.person.fullName(),
        email: faker.internet.email(),
        codigoZip: faker.location.zipCode(),
        endereco: faker.location.streetAddress(),
        numero: faker.location.buildingNumber(),
        bairro: faker.location.street(),
        cidade: "Franca",
        estado: "SP",
        complemento: faker.location.secondaryAddress(),
      },
      {
        nome: faker.person.fullName(),
        email: faker.internet.email(),
        codigoZip: faker.location.zipCode(),
        endereco: faker.location.streetAddress(),
        numero: faker.location.buildingNumber(),
        bairro: faker.location.street(),
        cidade: "São Paulo",
        estado: "SP",
        complemento: faker.location.secondaryAddress(),
      },
      {
        nome: faker.person.fullName(),
        email: faker.internet.email(),
        codigoZip: faker.location.zipCode(),
        endereco: faker.location.streetAddress(),
        numero: faker.location.buildingNumber(),
        bairro: faker.location.street(),
        cidade: "Rio de Janeiro",
        estado: "RJ",
        complemento: faker.location.secondaryAddress(),
      },
    ])
    .returning({ id: contatos.id });

  await db.insert(telefones).values([
    {
      numero: faker.phone.number(),
      contatoId: contatosInsert[0].id,
    },
    {
      numero: faker.phone.number(),
      contatoId: contatosInsert[0].id,
    },
    {
      numero: faker.phone.number(),
      contatoId: contatosInsert[0].id,
    },
    {
      numero: faker.phone.number(),
      contatoId: contatosInsert[1].id,
    },
  ]);
}

seed();
