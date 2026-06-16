export interface PrefabEntry {
  prefabId: string;
  name: string;
  category: 'prop' | 'building' | 'vegetation' | 'character' | 'fx';
  assetPath: string;
  tags?: string[];
}

export interface PrefabLibraryResult {
  success: boolean;
  prefabId: string;
  assetPath: string;
  generatedAt: string;
}

export class PrefabLibrary {
  private prefabs: Map<string, PrefabEntry> = new Map();

  register(entry: PrefabEntry): void {
    this.prefabs.set(entry.prefabId, entry);
  }

  lookup(prefabId: string): PrefabEntry | undefined {
    return this.prefabs.get(prefabId);
  }

  create(name: string, category: PrefabEntry['category'], tags?: string[]): PrefabLibraryResult {
    const prefabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const assetPath = `generated/prefabs/${category}/${prefabId}.rbxm`;
    this.register({ prefabId, name, category, assetPath, tags });
    return {
      success: true,
      prefabId,
      assetPath,
      generatedAt: new Date().toISOString(),
    };
  }
}
