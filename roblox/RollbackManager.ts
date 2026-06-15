export interface RollbackTarget {
  universeId: string;
  placeId: string;
  version: string;
  snapshotPath: string;
  createdAt: string;
}

export interface RollbackResult {
  success: boolean;
  rolledBackTo: string;
  rolledBackAt: string;
}

export class RollbackManager {
  private readonly snapshots = new Map<string, RollbackTarget[]>();

  snapshot(universeId: string, placeId: string, version: string, snapshotPath: string): RollbackTarget {
    const target: RollbackTarget = {
      universeId,
      placeId,
      version,
      snapshotPath,
      createdAt: new Date().toISOString(),
    };
    const key = `${universeId}:${placeId}`;
    const list = this.snapshots.get(key) ?? [];
    list.push(target);
    this.snapshots.set(key, list);
    return { ...target };
  }

  rollback(universeId: string, placeId: string, version?: string): RollbackResult {
    const key = `${universeId}:${placeId}`;
    const list = this.snapshots.get(key) ?? [];
    if (list.length === 0) throw new Error(`No snapshots available for ${key}`);
    const target = version
      ? list.find(s => s.version === version)
      : list[list.length - 2];
    if (!target) throw new Error(`Snapshot version not found: ${version}`);
    return { success: true, rolledBackTo: target.version, rolledBackAt: new Date().toISOString() };
  }

  listSnapshots(universeId: string, placeId: string): RollbackTarget[] {
    return [...(this.snapshots.get(`${universeId}:${placeId}`) ?? [])];
  }
}
