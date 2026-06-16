export interface RoadGenerationRequest {
  prompt: string;
  style?: 'dirt' | 'cobblestone' | 'asphalt' | 'highway' | 'path';
  width?: number;
  curveRadius?: number;
  robloxCompatible?: boolean;
}

export interface RoadGenerationResult {
  success: boolean;
  roadId: string;
  assetPath: string;
  generatedAt: string;
}

export class RoadGenerator {
  generate(request: RoadGenerationRequest): RoadGenerationResult {
    const roadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      roadId,
      assetPath: `generated/scene/roads/${roadId}.rbxm`,
      generatedAt: new Date().toISOString(),
    };
  }
}
