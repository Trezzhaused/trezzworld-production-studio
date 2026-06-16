export interface MarketplaceItem {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  downloadUrl?: string;
  tags?: string[];
  rating?: number;
}

export interface MarketplaceSearchOptions {
  query?: string;
  tags?: string[];
  limit?: number;
}

export class MarketplaceConnector {
  private readonly catalog = new Map<string, MarketplaceItem>();
  private baseUrl?: string;

  configure(baseUrl: string): void { this.baseUrl = baseUrl; }

  loadCatalog(items: MarketplaceItem[]): void {
    for (const item of items) this.catalog.set(item.id, item);
  }

  search(options: MarketplaceSearchOptions = {}): MarketplaceItem[] {
    let results = [...this.catalog.values()];
    if (options.query) {
      const q = options.query.toLowerCase();
      results = results.filter(
        i => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
      );
    }
    if (options.tags?.length) {
      results = results.filter(i => options.tags!.some(t => (i.tags ?? []).includes(t)));
    }
    if (options.limit) results = results.slice(0, options.limit);
    return results;
  }

  get(id: string): MarketplaceItem | undefined { return this.catalog.get(id); }

  list(): MarketplaceItem[] { return [...this.catalog.values()]; }

  getBaseUrl(): string | undefined { return this.baseUrl; }
}
