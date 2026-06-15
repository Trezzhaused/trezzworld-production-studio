export interface UIGenerationRequest {
  prompt: string;
  theme?: string;
  layout?: 'hud' | 'inventory' | 'shop' | 'menu';
  responsive?: boolean;
  robloxCompatible?: boolean;
}

export interface UIGenerationResult {
  success: boolean;
  uiId: string;
  assetPath: string;
  generatedAt: string;
}

export class UIGenerator {
  generate(request: UIGenerationRequest): UIGenerationResult {
    const uiId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      uiId,
      assetPath: `generated/ui/${uiId}.rbxmx`,
      generatedAt: new Date().toISOString(),
    };
  }
}
