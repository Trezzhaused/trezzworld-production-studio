export interface WaterGenerationRequest {
  prompt: string;
  type?: 'ocean' | 'river' | 'lake' | 'waterfall' | 'pond';
  waveIntensity?: number;
  depth?: number;
  robloxCompatible?: boolean;
}

export interface WaterGenerationResult {
  success: boolean;
  waterId: string;
  assetPath: string;
  generatedAt: string;
}

export class WaterGenerator {
  generate(request: WaterGenerationRequest): WaterGenerationResult {
    const waterId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      waterId,
      assetPath: `generated/scene/water/${waterId}.rbxm`,
      generatedAt: new Date().toISOString(),
    };
  }
}
