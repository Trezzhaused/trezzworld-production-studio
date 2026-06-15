export interface FileEntry {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified: string;
  tags: string[];
}

export class FileIndex {
  private readonly entries = new Map<string, FileEntry>();

  index(entry: FileEntry): void {
    this.entries.set(entry.path, { ...entry, tags: [...entry.tags] });
  }

  remove(path: string): boolean {
    return this.entries.delete(path);
  }

  get(path: string): FileEntry | undefined {
    const e = this.entries.get(path);
    return e ? { ...e, tags: [...e.tags] } : undefined;
  }

  search(query: string): FileEntry[] {
    const q = query.toLowerCase();
    return [...this.entries.values()]
      .filter(e => e.path.toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q)))
      .map(e => ({ ...e, tags: [...e.tags] }));
  }

  listByType(type: FileEntry['type']): FileEntry[] {
    return [...this.entries.values()]
      .filter(e => e.type === type)
      .map(e => ({ ...e, tags: [...e.tags] }));
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
