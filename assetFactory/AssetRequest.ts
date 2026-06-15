export type AssetCategory = 'image' | 'ui' | 'audio' | 'model' | 'animation';

export interface AssetRequest {
  id: string;
  category: AssetCategory;
  name: string;
  prompt: string;
  style?: string;
  resolution?: string;
  robloxCompatible: boolean;
  license: 'original' | 'third-party';
  tags: string[];
  createdAt: string;
}

export class AssetRequestBuilder {
  create(category: AssetCategory, name: string, prompt: string): AssetRequest {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      category,
      name,
      prompt,
      robloxCompatible: true,
      license: 'original',
      tags: [],
      createdAt: new Date().toISOString(),
    };
  }
}
