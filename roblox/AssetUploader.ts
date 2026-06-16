export interface UploadRequest {
  assetPath: string;
  assetType: 'model' | 'image' | 'audio' | 'animation' | 'place';
  name: string;
  description?: string;
}

export interface UploadResult {
  success: boolean;
  assetId: string;
  uploadedAt: string;
}

export class AssetUploader {
  private readonly uploads: UploadResult[] = [];

  upload(request: UploadRequest): UploadResult {
    const result: UploadResult = {
      success: true,
      assetId: `roblox-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      uploadedAt: new Date().toISOString(),
    };
    this.uploads.push(result);
    return { ...result };
  }

  uploadBatch(requests: UploadRequest[]): UploadResult[] {
    return requests.map(r => this.upload(r));
  }

  history(): UploadResult[] {
    return [...this.uploads];
  }
}
