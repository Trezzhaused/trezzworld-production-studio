export interface SkyGenerationRequest {
  prompt: string;
  style?: 'realistic' | 'stylized' | 'cartoon' | 'sci-fi';
  timeOfDay?: 'dawn' | 'day' | 'dusk' | 'night';
  cloudCoverage?: number;
  robloxCompatible?: boolean;
}

export interface SkyGenerationResult {
  success: boolean;
  skyId: string;
  assetPath: string;
  generatedAt: string;
}

export class SkyGenerator {
  generate(request: SkyGenerationRequest): SkyGenerationResult {
    const skyId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      skyId,
      assetPath: `generated/scene/sky/${skyId}.json`,
      generatedAt: new Date().toISOString(),
    };
  }
}
