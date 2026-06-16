export interface TerrainGenerationRequest {
  prompt: string;
  biome?: 'plains' | 'forest' | 'desert' | 'tundra' | 'mountains' | 'ocean';
  size?: number;
  heightVariance?: number;
  robloxCompatible?: boolean;
}

export interface TerrainGenerationResult {
  success: boolean;
  terrainId: string;
  assetPath: string;
  generatedAt: string;
}

export class TerrainGenerator {
  generate(request: TerrainGenerationRequest): TerrainGenerationResult {
    const terrainId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      terrainId,
      assetPath: `generated/terrain/${terrainId}.rbxl`,
      generatedAt: new Date().toISOString(),
    };
  }
}
