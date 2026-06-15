export interface RollbackSnapshot {
  id: string;
  timestamp: string;
  version: number;
  description?: string;
  state: unknown;
}

export class RollbackSnapshotManager {
  private snapshots: RollbackSnapshot[] = [];
  private version = 1;

  create(state: unknown, description?: string): RollbackSnapshot {
    const snapshot: RollbackSnapshot = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      version: this.version++,
      description,
      state,
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  list(): RollbackSnapshot[] {
    return [...this.snapshots];
  }

  restore(id: string): unknown {
    const snapshot = this.snapshots.find(s => s.id === id);
    if (!snapshot) throw new Error(`Snapshot not found: ${id}`);
    return snapshot.state;
  }

  latest(): RollbackSnapshot | undefined {
    return this.snapshots.at(-1);
  }
}
