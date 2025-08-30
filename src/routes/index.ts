import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { buildContactsController } from "../controllers/contacts/index.ts";
import { ContactService } from "../services/contactService.ts";
import { DrizzleContactRepository } from "../repositories/contactRepository.ts";
import { HgBrasilWeatherService } from "../services/weatherService.ts";

export const registerRoutes: FastifyPluginAsyncZod = async (server) => {
  const repository = new DrizzleContactRepository();
  const weather = new HgBrasilWeatherService();
  const service = new ContactService(repository, weather);

  await server.register(buildContactsController(service));
};
