import fastify from "fastify";
import { fastifySwagger } from "@fastify/swagger";
import {
  validatorCompiler,
  serializerCompiler,
  type ZodTypeProvider,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";
import scalarAPIReference from "@scalar/fastify-api-reference";
import { createContactRoute } from "./routes/contacts/createContact.ts";
import { listContactsRoute } from "./routes/contacts/listContacts.ts";
import { listOneContactRoute } from "./routes/contacts/listOneContact.ts";
import { deleteContactRoute } from "./routes/contacts/deleteContact.ts";
import { updateContactRoute } from "./routes/contacts/updateContact.ts";
import fastifySwaggerUi from "@fastify/swagger-ui";

const server = fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
}).withTypeProvider<ZodTypeProvider>();

if (process.env.NODE_ENV === "development") {
  server.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Desafio Node.js",
        version: "1.0.0",
      },
    },
    transform: jsonSchemaTransform,
  });

  server.register(fastifySwaggerUi, {
    routePrefix: "/docs",
  });

  // server.register(scalarAPIReference, {
  //   routePrefix: "/docs",
  // });
}

server.setSerializerCompiler(serializerCompiler);
server.setValidatorCompiler(validatorCompiler);

server.register(createContactRoute);
server.register(listContactsRoute);
server.register(listOneContactRoute);
server.register(deleteContactRoute);
server.register(updateContactRoute);

export { server };
