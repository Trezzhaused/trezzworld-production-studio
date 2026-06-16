export interface FileHash {
  path: string;
  hash: string;
}

export class IncrementalBuilder {
  private readonly hashes = new Map<string, string>();
  private readonly dirty = new Set<string>();

  track(path: string, hash: string): void {
    if (this.hashes.get(path) !== hash) {
      this.hashes.set(path, hash);
      this.dirty.add(path);
    }
  }

  markDirty(path: string): void { this.dirty.add(path); }
  markClean(path: string): void { this.dirty.delete(path); }

  isDirty(path: string): boolean { return this.dirty.has(path); }

  getDirty(): string[] { return [...this.dirty]; }

  clearDirty(): void { this.dirty.clear(); }

  snapshot(): FileHash[] {
    return [...this.hashes.entries()].map(([path, hash]) => ({ path, hash }));
  }

  restore(hashes: FileHash[]): void {
    this.hashes.clear();
    for (const { path, hash } of hashes) this.hashes.set(path, hash);
  }
}
