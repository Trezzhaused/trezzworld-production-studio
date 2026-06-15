export interface AssetRecord {
  id: string;
  name: string;
  type: string;
  tags: string[];
  dependencies: string[];
  usageCount: number;
}

export class AssetRegistry {
  private assets = new Map<string, AssetRecord>();

  register(asset: AssetRecord): AssetRecord {
    this.assets.set(asset.id, { ...asset });
    return { ...asset };
  }

  get(id: string): AssetRecord | undefined {
    const asset = this.assets.get(id);
    return asset ? { ...asset, tags: [...asset.tags], dependencies: [...asset.dependencies] } : undefined;
  }

  findByTag(tag: string): AssetRecord[] {
    return Array.from(this.assets.values())
      .filter(a => a.tags.includes(tag))
      .map(a => ({ ...a, tags: [...a.tags], dependencies: [...a.dependencies] }));
  }

  incrementUsage(id: string): void {
    const asset = this.assets.get(id);
    if (asset) asset.usageCount += 1;
  }
}
