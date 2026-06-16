export type ChangeType = 'add' | 'modify' | 'delete' | 'rename';

export interface Change {
  id: string;
  path: string;
  type: ChangeType;
  previousPath?: string;
  changedAt: string;
}

export class ChangeTracker {
  private readonly changes: Change[] = [];

  record(path: string, type: ChangeType, previousPath?: string): Change {
    const change: Change = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      path,
      type,
      previousPath,
      changedAt: new Date().toISOString(),
    };
    this.changes.push(change);
    return { ...change };
  }

  getChanges(since?: string): Change[] {
    if (!since) return [...this.changes];
    return this.changes.filter(c => c.changedAt >= since);
  }

  getByPath(path: string): Change[] {
    return this.changes.filter(c => c.path === path).map(c => ({ ...c }));
  }

  hasChanges(): boolean {
    return this.changes.length > 0;
  }

  clear(): void {
    this.changes.length = 0;
  }
}
