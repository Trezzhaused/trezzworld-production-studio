export interface ManifestEntry {
  id: string;
  name: string;
  version: string;
  type: 'script' | 'asset' | 'model' | 'config' | 'other';
  path: string;
  hash?: string;
  size?: number;
  dependencies?: string[];
}

export interface ManifestModel {
  projectId: string;
  version: string;
  builtAt: string;
  entries: ManifestEntry[];
  metadata?: Record<string, unknown>;
}

export class Manifest {
  constructor(private model: ManifestModel) {}

  addEntry(entry: ManifestEntry): void { this.model.entries.push(entry); }

  getEntry(id: string): ManifestEntry | undefined { return this.model.entries.find(e => e.id === id); }

  removeEntry(id: string): boolean {
    const before = this.model.entries.length;
    this.model.entries = this.model.entries.filter(e => e.id !== id);
    return this.model.entries.length !== before;
  }

  list(type?: ManifestEntry['type']): ManifestEntry[] {
    return type ? this.model.entries.filter(e => e.type === type) : [...this.model.entries];
  }

  getModel(): ManifestModel { return { ...this.model, entries: [...this.model.entries] }; }

  serialize(): string { return JSON.stringify(this.model, null, 2); }

  static deserialize(json: string): Manifest { return new Manifest(JSON.parse(json)); }

  static create(projectId: string, version: string): Manifest {
    return new Manifest({ projectId, version, builtAt: new Date().toISOString(), entries: [] });
  }
}
