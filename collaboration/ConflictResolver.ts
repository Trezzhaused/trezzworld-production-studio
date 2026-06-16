export type ConflictResolutionStrategy = 'ours' | 'theirs' | 'merge' | 'manual';

export interface Conflict {
  id: string;
  path: string;
  ours: string;
  theirs: string;
  base?: string;
  resolvedWith?: ConflictResolutionStrategy;
  resolution?: string;
  resolvedAt?: string;
}

export class ConflictResolver {
  private readonly conflicts = new Map<string, Conflict>();

  register(path: string, ours: string, theirs: string, base?: string): Conflict {
    const conflict: Conflict = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      path, ours, theirs, base,
    };
    this.conflicts.set(conflict.id, conflict);
    return { ...conflict };
  }

  resolve(id: string, strategy: ConflictResolutionStrategy, manual?: string): Conflict {
    const c = this.require(id);
    c.resolvedWith = strategy;
    c.resolvedAt = new Date().toISOString();
    if (strategy === 'ours') c.resolution = c.ours;
    else if (strategy === 'theirs') c.resolution = c.theirs;
    else if (strategy === 'manual') c.resolution = manual ?? '';
    else c.resolution = `${c.ours}\n${c.theirs}`;
    return { ...c };
  }

  list(resolved?: boolean): Conflict[] {
    const all = [...this.conflicts.values()].map(c => ({ ...c }));
    if (resolved === undefined) return all;
    return resolved ? all.filter(c => !!c.resolvedWith) : all.filter(c => !c.resolvedWith);
  }

  hasUnresolved(): boolean { return this.list(false).length > 0; }

  private require(id: string): Conflict {
    const c = this.conflicts.get(id);
    if (!c) throw new Error(`Conflict not found: ${id}`);
    return c;
  }
}
