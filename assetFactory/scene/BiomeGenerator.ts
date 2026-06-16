export interface BiomeGenerationRequest {
  prompt: string;
  biomeType?: 'plains' | 'forest' | 'desert' | 'tundra' | 'swamp' | 'volcanic' | 'arctic' | 'jungle';
  transitionBlend?: number;
  robloxCompatible?: boolean;
}

export interface BiomeGenerationResult {
  success: boolean;
  biomeId: string;
  assetPath: string;
  generatedAt: string;
}

export class BiomeGenerator {
  generate(request: BiomeGenerationRequest): BiomeGenerationResult {
    const biomeId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      biomeId,
      assetPath: `generated/scene/biomes/${biomeId}.json`,
      generatedAt: new Date().toISOString(),
    };
  }
}
