export interface AssetVersion {
  id: string;
  assetId: string;
  version: number;
  parentVersionId?: string;
  changeNotes?: string;
  createdAt: string;
  active: boolean;
}

export class AssetVersionManager {
  private versions = new Map<string, AssetVersion[]>();

  createVersion(assetId: string, changeNotes?: string): AssetVersion {
    const history = this.versions.get(assetId) ?? [];
    history.forEach(v => (v.active = false));
    const version: AssetVersion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      assetId,
      version: history.length + 1,
      parentVersionId: history.length ? history[history.length - 1].id : undefined,
      changeNotes,
      createdAt: new Date().toISOString(),
      active: true,
    };
    history.push(version);
    this.versions.set(assetId, history);
    return { ...version };
  }

  getHistory(assetId: string): AssetVersion[] {
    return (this.versions.get(assetId) ?? []).map(v => ({ ...v }));
  }
}
