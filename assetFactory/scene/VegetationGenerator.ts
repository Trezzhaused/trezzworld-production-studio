export interface VegetationGenerationRequest {
  prompt: string;
  density?: number;
  types?: ('trees' | 'shrubs' | 'grass' | 'flowers' | 'ferns')[];
  biomeId?: string;
  robloxCompatible?: boolean;
}

export interface VegetationGenerationResult {
  success: boolean;
  vegetationId: string;
  assetPath: string;
  generatedAt: string;
}

export class VegetationGenerator {
  generate(request: VegetationGenerationRequest): VegetationGenerationResult {
    const vegetationId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      vegetationId,
      assetPath: `generated/scene/vegetation/${vegetationId}.rbxm`,
      generatedAt: new Date().toISOString(),
    };
  }
}
