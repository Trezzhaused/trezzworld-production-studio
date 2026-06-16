export interface RecentEntry {
  projectId: string;
  name: string;
  path: string;
  openedAt: string;
  pinned?: boolean;
}

export class RecentProjects {
  private readonly entries: RecentEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 20) { this.maxEntries = maxEntries; }

  record(projectId: string, name: string, path: string): void {
    const idx = this.entries.findIndex(e => e.projectId === projectId);
    const now = new Date().toISOString();
    if (idx !== -1) {
      const pinned = this.entries[idx].pinned;
      this.entries.splice(idx, 1);
      this.entries.unshift({ projectId, name, path, openedAt: now, pinned });
    } else {
      this.entries.unshift({ projectId, name, path, openedAt: now });
    }
    const unpinned = this.entries.filter(e => !e.pinned);
    while (unpinned.length > this.maxEntries) {
      const last = unpinned.pop()!;
      const li = this.entries.findIndex(e => e.projectId === last.projectId);
      if (li !== -1) this.entries.splice(li, 1);
    }
  }

  remove(projectId: string): boolean {
    const idx = this.entries.findIndex(e => e.projectId === projectId);
    if (idx !== -1) { this.entries.splice(idx, 1); return true; }
    return false;
  }

  pin(projectId: string): void { this.requireEntry(projectId).pinned = true; }
  unpin(projectId: string): void { this.requireEntry(projectId).pinned = false; }

  list(): RecentEntry[] { return [...this.entries]; }

  clear(): void { this.entries.length = 0; }

  private requireEntry(id: string): RecentEntry {
    const e = this.entries.find(x => x.projectId === id);
    if (!e) throw new Error(`Recent project not found: ${id}`);
    return e;
  }
}
