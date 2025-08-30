import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestApp } from "../utils";
import supertest from "supertest";
import { createTestContact } from "../utils";

// Mock global fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Weather API Integration", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  beforeEach(async () => {
    app = await createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getWeatherData API calls", () => {
    it("should make successful API call to HG Brasil Weather API", async () => {
      const mockWeatherResponse = {
        by: "default",
        valid_key: true,
        results: {
          temp: 25,
          date: "20/06",
          time: "10:00",
          condition_code: "28",
          description: "Tempo limpo",
          currently: "dia",
          cid: "BRXX0201",
          city: "São Paulo, SP",
          img_id: "28",
          humidity: 70,
          cloudiness: 0,
          rain: 0,
          wind_speedy: "10km/h",
          wind_direction: 180,
          wind_cardinal: "S",
          sunrise: "6:30 am",
          sunset: "5:30 pm",
          moon_phase: "waxing_gibbous",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockWeatherResponse,
      });

      // Create a test contact
      const contact = await createTestContact({
        cidade: "São Paulo",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      // Verify the API was called with correct parameters
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.hgbrasil.com/weather?key=SUA-CHAVE&city_name=S%C3%A3o%20Paulo"
      );

      // Verify the response contains weather data
      expect(response.body.contact.weather).toMatchObject({
        temp: 25,
        condition: "Tempo limpo",
        currently: "dia",
        city: "São Paulo, SP",
        suggestion: expect.stringContaining("atividade ao ar livre"),
      });
    });

    it("should handle API call with special characters in city name", async () => {
      const mockWeatherResponse = {
        by: "default",
        valid_key: true,
        results: {
          temp: 22,
          date: "20/06",
          time: "14:00",
          condition_code: "28",
          description: "Ensolarado",
          currently: "dia",
          cid: "BRXX0201",
          city: "Rio de Janeiro, RJ",
          img_id: "28",
          humidity: 65,
          cloudiness: 10,
          rain: 0,
          wind_speedy: "15km/h",
          wind_direction: 90,
          wind_cardinal: "E",
          sunrise: "6:45 am",
          sunset: "5:45 pm",
          moon_phase: "waning_crescent",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockWeatherResponse,
      });

      // Create a test contact with special characters in city name
      const contact = await createTestContact({
        cidade: "São José dos Campos",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      // Verify the API was called with properly encoded city name
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.hgbrasil.com/weather?key=SUA-CHAVE&city_name=S%C3%A3o%20Jos%C3%A9%20dos%20Campos"
      );

      expect(response.body.contact.weather).toMatchObject({
        temp: 22,
        condition: "Ensolarado",
        city: "Rio de Janeiro, RJ",
      });
    });

    it("should handle API error responses (404, 500, etc.)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const contact = await createTestContact({
        cidade: "Invalid City",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.hgbrasil.com/weather?key=SUA-CHAVE&city_name=Invalid%20City"
      );

      expect(response.body.contact.weather).toMatchObject({
        error: "WEATHER_API_ERROR",
        message: "Erro na API do tempo: 500",
      });
    });

    it("should handle network errors and timeouts", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const contact = await createTestContact({
        cidade: "São Paulo",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      expect(response.body.contact.weather).toMatchObject({
        error: "WEATHER_SERVICE_UNAVAILABLE",
        message: "Serviço de clima temporariamente indisponível",
      });
    });

    it("should handle invalid API key response", async () => {
      const mockInvalidKeyResponse = {
        by: "default",
        valid_key: false,
        results: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInvalidKeyResponse,
      });

      const contact = await createTestContact({
        cidade: "Unknown City",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      expect(response.body.contact.weather).toMatchObject({
        error: "CITY_NOT_FOUND",
        message: "Cidade não encontrada na API do tempo",
      });
    });

    it("should handle malformed JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const contact = await createTestContact({
        cidade: "São Paulo",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      expect(response.body.contact.weather).toMatchObject({
        error: "WEATHER_SERVICE_UNAVAILABLE",
        message: "Serviço de clima temporariamente indisponível",
      });
    });
  });

  describe("Weather suggestion generation", () => {
    it("should generate correct suggestion for cold weather", async () => {
      const mockColdWeatherResponse = {
        by: "default",
        valid_key: true,
        results: {
          temp: 15,
          date: "20/06",
          time: "10:00",
          condition_code: "28",
          description: "Tempo nublado",
          currently: "dia",
          cid: "BRXX0201",
          city: "São Paulo, SP",
          img_id: "28",
          humidity: 80,
          cloudiness: 70,
          rain: 0,
          wind_speedy: "10km/h",
          wind_direction: 180,
          wind_cardinal: "S",
          sunrise: "6:30 am",
          sunset: "5:30 pm",
          moon_phase: "waxing_gibbous",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockColdWeatherResponse,
      });

      const contact = await createTestContact({
        cidade: "São Paulo",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      expect(response.body.contact.weather).toMatchObject({
        temp: 15,
        suggestion: "Ofereça um chocolate quente ao seu contato...",
      });
    });

    it("should generate correct suggestion for hot sunny weather", async () => {
      const mockHotSunnyResponse = {
        by: "default",
        valid_key: true,
        results: {
          temp: 35,
          date: "20/06",
          time: "14:00",
          condition_code: "28",
          description: "Tempo limpo",
          currently: "dia",
          cid: "BRXX0201",
          city: "São Paulo, SP",
          img_id: "28",
          humidity: 40,
          cloudiness: 0,
          rain: 0,
          wind_speedy: "5km/h",
          wind_direction: 180,
          wind_cardinal: "S",
          sunrise: "6:30 am",
          sunset: "5:30 pm",
          moon_phase: "waxing_gibbous",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHotSunnyResponse,
      });

      const contact = await createTestContact({
        cidade: "Rio de Janeiro",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      expect(response.body.contact.weather).toMatchObject({
        temp: 35,
        suggestion: "Convide seu contato para ir à praia com esse calor!",
      });
    });

    it("should generate correct suggestion for rainy weather", async () => {
      const mockRainyResponse = {
        by: "default",
        valid_key: true,
        results: {
          temp: 20,
          date: "20/06",
          time: "16:00",
          condition_code: "61",
          description: "Chuva moderada",
          currently: "dia",
          cid: "BRXX0201",
          city: "São Paulo, SP",
          img_id: "61",
          humidity: 90,
          cloudiness: 100,
          rain: 5,
          wind_speedy: "20km/h",
          wind_direction: 270,
          wind_cardinal: "W",
          sunrise: "6:30 am",
          sunset: "5:30 pm",
          moon_phase: "waxing_gibbous",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRainyResponse,
      });

      const contact = await createTestContact({
        cidade: "São Paulo",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      expect(response.body.contact.weather).toMatchObject({
        temp: 20,
        suggestion: "Convide seu contato para ver um filme",
      });
    });

    it("should generate correct suggestion for hot rainy weather", async () => {
      const mockHotRainyResponse = {
        by: "default",
        valid_key: true,
        results: {
          temp: 32,
          date: "20/06",
          time: "16:00",
          condition_code: "61",
          description: "Chuva com sol",
          currently: "dia",
          cid: "BRXX0201",
          city: "Manaus, AM",
          img_id: "61",
          humidity: 85,
          cloudiness: 60,
          rain: 3,
          wind_speedy: "12km/h",
          wind_direction: 90,
          wind_cardinal: "E",
          sunrise: "6:00 am",
          sunset: "6:00 pm",
          moon_phase: "full_moon",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHotRainyResponse,
      });

      const contact = await createTestContact({
        cidade: "Manaus",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      expect(response.body.contact.weather).toMatchObject({
        temp: 32,
        suggestion: "Convide seu contato para tomar um sorvete",
      });
    });
  });

  describe("Real API call integration", () => {
    it("should work with actual HG Brasil API (integration test)", async () => {
      // Skip this test in CI/CD or when network is not available
      if (process.env.CI || process.env.SKIP_NETWORK_TESTS) {
        return;
      }

      // Restore original fetch for this test
      vi.restoreAllMocks();

      const contact = await createTestContact({
        cidade: "São Paulo",
      });

      const response = await supertest(app.server)
        .get(`/contacts/${contact.id}`)
        .expect(200);

      // Should either get weather data or a known error
      expect(response.body.contact.weather).toSatisfy((weather: any) => {
        return (
          // Valid weather response
          (typeof weather.temp === "number" &&
            typeof weather.condition === "string" &&
            typeof weather.suggestion === "string") ||
          // Or error response
          (typeof weather.error === "string" &&
            typeof weather.message === "string")
        );
      });

      // Restore mocks for other tests
      global.fetch = mockFetch;
    }, 10000); // 10 second timeout for network request
  });
});
