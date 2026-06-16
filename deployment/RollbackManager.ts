export interface RollbackSnapshot {
  id: string;
  versionId: string;
  label?: string;
  createdAt: string;
  data: unknown;
}

export class RollbackManager {
  private readonly snapshots: RollbackSnapshot[] = [];
  private maxSnapshots: number;

  constructor(maxSnapshots = 10) { this.maxSnapshots = maxSnapshots; }

  snapshot(versionId: string, data: unknown, label?: string): RollbackSnapshot {
    const snap: RollbackSnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      versionId, label,
      createdAt: new Date().toISOString(),
      data,
    };
    this.snapshots.push(snap);
    if (this.snapshots.length > this.maxSnapshots) this.snapshots.shift();
    return { ...snap };
  }

  rollback(snapshotId: string): unknown {
    const snap = this.snapshots.find(s => s.id === snapshotId);
    if (!snap) throw new Error(`Snapshot not found: ${snapshotId}`);
    return snap.data;
  }

  latest(): RollbackSnapshot | undefined {
    return this.snapshots.length ? { ...this.snapshots[this.snapshots.length - 1] } : undefined;
  }

  list(): RollbackSnapshot[] { return this.snapshots.map(s => ({ ...s })); }

  clear(): void { this.snapshots.length = 0; }
}
