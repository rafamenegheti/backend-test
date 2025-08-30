import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ContactService } from "../../services/contactService.ts";
import { buildCreateContact } from "./create.ts";
import { buildListContacts } from "./list.ts";
import { buildGetOneContact } from "./getOne.ts";
import { buildUpdateContact } from "./update.ts";
import { buildDeleteContact } from "./delete.ts";

export function buildContactsController(
  service: ContactService
): FastifyPluginAsyncZod {
  const plugin: FastifyPluginAsyncZod = async (server) => {
    await server.register(buildCreateContact(service));
    await server.register(buildListContacts(service));
    await server.register(buildGetOneContact(service));
    await server.register(buildUpdateContact(service));
    await server.register(buildDeleteContact(service));
  };
  return plugin;
}
