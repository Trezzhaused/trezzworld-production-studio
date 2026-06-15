import { FileIndex, FileEntry } from './FileIndex';

export interface SearchResult {
  entry: FileEntry;
  score: number;
}

export class WorkspaceSearch {
  constructor(private readonly index: FileIndex) {}

  search(query: string, limit = 20): SearchResult[] {
    const results = this.index.search(query);
    return results
      .map(entry => ({ entry, score: this.score(entry, query) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  searchByType(type: FileEntry['type']): FileEntry[] {
    return this.index.listByType(type);
  }

  searchByTag(tag: string): FileEntry[] {
    return this.index.search(tag).filter(e => e.tags.includes(tag));
  }

  private score(entry: FileEntry, query: string): number {
    const q = query.toLowerCase();
    const path = entry.path.toLowerCase();
    if (path === q) return 100;
    if (path.endsWith(`/${q}`) || path.endsWith(`\\${q}`)) return 90;
    if (path.includes(q)) return 70;
    if (entry.tags.some(t => t.toLowerCase() === q)) return 60;
    return 40;
  }
}
