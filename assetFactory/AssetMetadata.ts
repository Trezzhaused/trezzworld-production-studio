export interface AssetMetadata {
  assetId: string;
  author: string;
  owner: string;
  license: string;
  category: string;
  tags: string[];
  format?: string;
  resolution?: string;
  robloxCompatible: boolean;
  createdAt: string;
  updatedAt: string;
}

export class AssetMetadataManager {
  create(metadata: Omit<AssetMetadata,'createdAt'|'updatedAt'>): AssetMetadata {
    const now = new Date().toISOString();
    return {
      ...metadata,
      createdAt: now,
      updatedAt: now,
    };
  }

  touch(metadata: AssetMetadata): AssetMetadata {
    return {
      ...metadata,
      updatedAt: new Date().toISOString(),
    };
  }
}
