import {
  ContactRepository,
  CreateContactInput,
  UpdateContactInput,
  type ContactRow,
} from "../repositories/contactRepository.ts";
import { WeatherService } from "./weatherService.ts";

export type PhoneSummary = { id: string; numero: string };

export type ContactListItem = Omit<ContactRow, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  telefones: PhoneSummary[];
};

export type ContactWithWeather = ContactListItem & {
  weather:
    | {
        error: string;
        message: string;
      }
    | {
        temp: number;
        condition: string;
        currently: string;
        city: string;
        suggestion: string;
        condition_code: string;
      };
};

export class ContactService {
  constructor(
    private readonly repository: ContactRepository,
    private readonly weatherService: WeatherService
  ) {}

  async create(input: CreateContactInput): Promise<{ id: string }> {
    return this.repository.create(input);
  }

  async list(params: {
    search?: string;
    ativo?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    contacts: ContactListItem[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const page = params.page ?? 1;
    const requestedLimit = params.limit ?? 10;
    const limit = Math.min(requestedLimit, 100);
    const offset = (page - 1) * limit;
    const ativo =
      params.ativo !== undefined ? params.ativo === "true" : undefined;

    const { items, totalItems } = await this.repository.list({
      search: params.search,
      ativo,
      limit,
      offset,
    });

    const contacts: ContactListItem[] = items.map((contact) => ({
      ...contact,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    }));

    const totalPages = Math.ceil(totalItems / limit);
    return {
      contacts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getWithWeather(id: string): Promise<
    | { error: "CONTACT_NOT_FOUND"; message: string }
    | {
        contact: ContactWithWeather;
      }
  > {
    const contact = await this.repository.findById(id);
    if (!contact || !contact.ativo) {
      return { error: "CONTACT_NOT_FOUND", message: "Contato não encontrado" };
    }

    const weather = await this.weatherService.getWeatherData(
      contact.cidade,
      contact.estado
    );

    const formatted: ContactWithWeather = {
      ...contact,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      weather:
        "error" in weather
          ? { error: weather.error, message: weather.message }
          : {
              temp: weather.temp,
              condition: weather.condition,
              currently: weather.currently,
              city: weather.city,
              suggestion: weather.suggestion,
              condition_code: weather.condition_code,
            },
    };

    return { contact: formatted };
  }

  async update(
    id: string,
    input: UpdateContactInput
  ): Promise<
    | { error: "CONTACT_NOT_FOUND"; message: string }
    | { error: "DUPLICATE_EMAIL"; message: string }
    | { success: true; contactId: string }
  > {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return { error: "CONTACT_NOT_FOUND", message: "Contato não encontrado" };
    }

    if (input.email && input.email !== existing.email) {
      const taken = await this.repository.existsByEmail(input.email);
      if (taken) {
        return {
          error: "DUPLICATE_EMAIL",
          message: "Este email já está cadastrado",
        };
      }
    }

    const ok = await this.repository.update(id, input);
    if (!ok)
      return { error: "CONTACT_NOT_FOUND", message: "Contato não encontrado" };
    return { success: true, contactId: id };
  }

  async softDelete(id: string): Promise<
    | {
        error: "CONTACT_NOT_FOUND" | "CONTACT_ALREADY_INACTIVE";
        message: string;
      }
    | { success: true; contactId: string }
  > {
    const existing = await this.repository.findById(id);

    if (!existing)
      return { error: "CONTACT_NOT_FOUND", message: "Contato não encontrado" };

    if (!existing.ativo)
      return {
        error: "CONTACT_ALREADY_INACTIVE",
        message: "Contato já está inativo",
      };

    const ok = await this.repository.softDelete(id);
    if (!ok)
      return { error: "CONTACT_NOT_FOUND", message: "Contato não encontrado" };

    return { success: true, contactId: id };
  }
}
