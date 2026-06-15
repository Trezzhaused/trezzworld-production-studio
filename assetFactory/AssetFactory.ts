export type AssetType = 'image' | 'ui' | 'audio' | 'model' | 'animation';

export interface AssetRequest {
  id: string;
  type: AssetType;
  name: string;
  prompt: string;
  createdAt: string;
}

export interface AssetResult {
  id: string;
  type: AssetType;
  name: string;
  status: 'generated';
  generatedAt: string;
}

export class AssetFactory {
  createRequest(type: AssetType, name: string, prompt: string): AssetRequest {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      name,
      prompt,
      createdAt: new Date().toISOString(),
    };
  }

  generate(request: AssetRequest): AssetResult {
    return {
      id: request.id,
      type: request.type,
      name: request.name,
      status: 'generated',
      generatedAt: new Date().toISOString(),
    };
  }

  supportedTypes(): AssetType[] {
    return ['image','ui','audio','model','animation'];
  }
}
