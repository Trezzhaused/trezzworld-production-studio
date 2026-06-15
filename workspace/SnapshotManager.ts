export interface Snapshot {
  id: string;
  label: string;
  data: string;
  createdAt: string;
}

export class SnapshotManager {
  private readonly snapshots: Snapshot[] = [];

  create(label: string, data: unknown): Snapshot {
    const snapshot: Snapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label,
      data: JSON.stringify(data),
      createdAt: new Date().toISOString(),
    };
    this.snapshots.push(snapshot);
    return { ...snapshot };
  }

  restore<T>(id: string): T {
    const snapshot = this.snapshots.find(s => s.id === id);
    if (!snapshot) throw new Error(`Snapshot not found: ${id}`);
    return JSON.parse(snapshot.data) as T;
  }

  get(id: string): Snapshot | undefined {
    return this.snapshots.find(s => s.id === id);
  }

  list(): Snapshot[] {
    return [...this.snapshots].map(s => ({ ...s }));
  }

  delete(id: string): boolean {
    const idx = this.snapshots.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.snapshots.splice(idx, 1);
    return true;
  }
}
