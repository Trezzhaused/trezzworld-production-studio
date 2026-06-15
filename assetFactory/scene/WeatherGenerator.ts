export interface WeatherGenerationRequest {
  prompt: string;
  type?: 'clear' | 'rain' | 'storm' | 'snow' | 'fog' | 'sandstorm' | 'hail';
  intensity?: number;
  duration?: number;
  robloxCompatible?: boolean;
}

export interface WeatherGenerationResult {
  success: boolean;
  weatherId: string;
  assetPath: string;
  generatedAt: string;
}

export class WeatherGenerator {
  generate(request: WeatherGenerationRequest): WeatherGenerationResult {
    const weatherId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      weatherId,
      assetPath: `generated/scene/weather/${weatherId}.json`,
      generatedAt: new Date().toISOString(),
    };
  }
}
