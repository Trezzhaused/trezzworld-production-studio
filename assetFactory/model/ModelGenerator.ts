export interface ModelGenerationRequest {
  prompt: string;
  category?: 'prop' | 'building' | 'environment' | 'character' | 'npc';
  materials?: string[];
  lod?: number;
  robloxCompatible?: boolean;
}

export interface ModelGenerationResult {
  success: boolean;
  modelId: string;
  assetPath: string;
  generatedAt: string;
}

export class ModelGenerator {
  generate(request: ModelGenerationRequest): ModelGenerationResult {
    const modelId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      modelId,
      assetPath: `generated/models/${modelId}.fbx`,
      generatedAt: new Date().toISOString(),
    };
  }
}
