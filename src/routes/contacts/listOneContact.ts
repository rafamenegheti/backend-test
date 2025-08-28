import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "../../database/client.ts";
import { contatos, telefones } from "../../database/schema.ts";
import { eq } from "drizzle-orm";
import z from "zod";

interface WeatherError {
  error: string;
  message: string;
}

interface WeatherSuggestion {
  temp: number;
  condition_code: string;
  condition: string;
  currently: string;
  city: string;
  suggestion: string;
}

interface HGBrasilResponse {
  by: string;
  valid_key: boolean;
  results: {
    temp: number;
    date: string;
    time: string;
    condition_code: string;
    description: string;
    currently: string;
    cid: string;
    city: string;
    img_id: string;
    humidity: number;
    cloudiness: number;
    rain: number;
    wind_speedy: string;
    wind_direction: number;
    wind_cardinal: string;
    sunrise: string;
    sunset: string;
    moon_phase: string;
  };
}

function generateWeatherSuggestion(temp: number, condition: string): string {
  const isRainy =
    condition.toLowerCase().includes("chuva") ||
    condition.toLowerCase().includes("chuvisco") ||
    condition.toLowerCase().includes("garoa") ||
    condition.toLowerCase().includes("precipitação");

  const isSunny =
    condition.toLowerCase().includes("limpo") ||
    condition.toLowerCase().includes("sol") ||
    condition.toLowerCase().includes("ensolarado") ||
    condition.toLowerCase().includes("claro");

  if (temp <= 18) {
    return "Ofereça um chocolate quente ao seu contato...";
  }

  if (temp >= 30) {
    if (isRainy) {
      return "Convide seu contato para tomar um sorvete";
    } else if (isSunny) {
      return "Convide seu contato para ir à praia com esse calor!";
    }
    // Default for temp >= 30 when condition is unclear
    return "Convide seu contato para tomar um sorvete";
  }

  // Between 18° and 30°
  if (isRainy) {
    return "Convide seu contato para ver um filme";
  } else if (isSunny) {
    return "Convide seu contato para fazer alguma atividade ao ar livre";
  }

  // Default for moderate temperature when condition is unclear
  return "Convide seu contato para fazer alguma atividade ao ar livre";
}

async function getWeatherData(
  city: string
): Promise<WeatherSuggestion | WeatherError> {
  try {
    // HG Brasil Weather API (free tier - no key required for basic usage)
    const response = await fetch(
      `https://api.hgbrasil.com/weather?format=json-cors&city_name=${encodeURIComponent(
        city
      )}`
    );

    if (!response.ok) {
      return {
        error: "WEATHER_API_ERROR",
        message: `Erro na API do tempo: ${response.status}`,
      };
    }

    const data: HGBrasilResponse = await response.json();

    if (!data.valid_key && !data.results) {
      return {
        error: "CITY_NOT_FOUND",
        message: "Cidade não encontrada na API do tempo",
      };
    }

    const temp = data.results.temp;
    const condition = data.results.description;
    const suggestion = generateWeatherSuggestion(temp, condition);

    return {
      temp,
      condition_code: data.results.condition_code,
      condition,
      currently: data.results.currently,
      city: data.results.city,
      suggestion,
    };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return {
      error: "WEATHER_SERVICE_UNAVAILABLE",
      message: "Serviço de clima temporariamente indisponível",
    };
  }
}

export const listOneContactRoute: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/contacts/:id",
    {
      schema: {
        tags: ["Contact"],
        summary: "Get a specific contact with weather information",
        params: z.object({
          id: z.string().uuid("Invalid contact ID format"),
        }),
        response: {
          200: z
            .object({
              contact: z.object({
                id: z.uuid(),
                nome: z.string(),
                email: z.string(),
                codigoZip: z.string(),
                endereco: z.string(),
                numero: z.string(),
                bairro: z.string(),
                cidade: z.string(),
                estado: z.string(),
                complemento: z.string().nullable(),
                ativo: z.boolean(),
                createdAt: z.string(),
                updatedAt: z.string(),
                telefones: z.array(
                  z.object({
                    id: z.string().uuid(),
                    numero: z.string(),
                  })
                ),
                weather: z.union([
                  z.object({
                    temp: z.number(),
                    condition: z.string(),
                    currently: z.string(),
                    city: z.string(),
                    suggestion: z.string(),
                  }),
                  z.object({
                    error: z.string(),
                    message: z.string(),
                  }),
                ]),
              }),
            })
            .describe("Contact details with weather information"),
          404: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Contact not found"),
          500: z
            .object({
              error: z.string(),
              message: z.string(),
            })
            .describe("Internal server error"),
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        // Get the contact
        const contacts = await db
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

        if (contacts.length === 0) {
          return reply.status(404).send({
            error: "CONTACT_NOT_FOUND",
            message: "Contato não encontrado",
          });
        }

        const contact = contacts[0];

        // Only show active contacts
        if (!contact.ativo) {
          return reply.status(404).send({
            error: "CONTACT_NOT_FOUND",
            message: "Contato não encontrado",
          });
        }

        // Get phone numbers for the contact
        const phoneNumbers = await db
          .select({
            id: telefones.id,
            numero: telefones.numero,
          })
          .from(telefones)
          .where(eq(telefones.contatoId, contact.id));

        // Get weather data for the contact's city
        const weatherData = await getWeatherData(contact.cidade);

        // Format the response
        const contactWithDetails = {
          ...contact,
          createdAt: contact.createdAt.toISOString(),
          updatedAt: contact.updatedAt.toISOString(),
          telefones: phoneNumbers,
          weather:
            "error" in weatherData
              ? {
                  error: weatherData.error,
                  message: weatherData.message,
                }
              : {
                  temp: weatherData.temp,
                  condition: weatherData.condition,
                  currently: weatherData.currently,
                  city: weatherData.city,
                  suggestion: weatherData.suggestion,
                },
        };

        return reply.status(200).send({
          contact: contactWithDetails,
        });
      } catch (error: any) {
        // Handle specific database errors
        if (error.code) {
          return reply.status(500).send({
            error: "DATABASE_ERROR",
            message: "Erro ao consultar contato",
          });
        }

        // Generic server error
        return reply.status(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "Erro interno do servidor. Tente novamente mais tarde.",
        });
      }
    }
  );
};
