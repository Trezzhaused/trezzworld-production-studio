export interface ImageGenerationRequest {
  prompt: string;
  style?: string;
  width?: number;
  height?: number;
  robloxOptimized?: boolean;
}

export interface ImageGenerationResult {
  success: boolean;
  imageId: string;
  assetPath: string;
  generatedAt: string;
}

export class ImageGenerator {
  generate(request: ImageGenerationRequest): ImageGenerationResult {
    const imageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      imageId,
      assetPath: `generated/images/${imageId}.png`,
      generatedAt: new Date().toISOString(),
    };
  }
}
