export interface WeatherSuggestion {
  temp: number;
  condition_code: string;
  condition: string;
  currently: string;
  city: string;
  suggestion: string;
}

export interface WeatherError {
  error: string;
  message: string;
}

export interface WeatherService {
  getWeatherData(city: string): Promise<WeatherSuggestion | WeatherError>;
}

export class HgBrasilWeatherService implements WeatherService {
  private generateWeatherSuggestion(temp: number, condition: string): string {
    const normalized = condition.toLowerCase();
    const isRainy =
      normalized.includes("chuva") ||
      normalized.includes("chuvisco") ||
      normalized.includes("garoa") ||
      normalized.includes("precipitação");
    const isSunny =
      normalized.includes("limpo") ||
      normalized.includes("sol") ||
      normalized.includes("ensolarado") ||
      normalized.includes("claro");

    if (temp <= 18) {
      return "Ofereça um chocolate quente ao seu contato...";
    }

    if (temp >= 30) {
      if (isRainy) {
        return "Convide seu contato para tomar um sorvete";
      } else if (isSunny) {
        return "Convide seu contato para ir à praia com esse calor!";
      }
      return "Convide seu contato para tomar um sorvete";
    }

    if (isRainy) {
      return "Convide seu contato para ver um filme";
    } else if (isSunny) {
      return "Convide seu contato para fazer alguma atividade ao ar livre";
    }

    return "Convide seu contato para fazer alguma atividade ao ar livre";
  }

  async getWeatherData(
    city: string
  ): Promise<WeatherSuggestion | WeatherError> {
    try {
      const response = await fetch(
        `https://api.hgbrasil.com/weather?key=SUA-CHAVE&city_name=${encodeURIComponent(
          city
        )}`
      );

      if (!response.ok) {
        return {
          error: "WEATHER_API_ERROR",
          message: `Erro na API do tempo: ${response.status}`,
        };
      }

      const data: any = await response.json();

      if (!data.valid_key && !data.results) {
        return {
          error: "CITY_NOT_FOUND",
          message: "Cidade não encontrada na API do tempo",
        };
      }

      const temp: number = data.results.temp;
      const condition: string = data.results.description;
      const suggestion = this.generateWeatherSuggestion(temp, condition);

      return {
        temp,
        condition_code: data.results.condition_code,
        condition,
        currently: data.results.currently,
        city: data.results.city,
        suggestion,
      };
    } catch (error) {
      return {
        error: "WEATHER_SERVICE_UNAVAILABLE",
        message: "Serviço de clima temporariamente indisponível",
      };
    }
  }
}
