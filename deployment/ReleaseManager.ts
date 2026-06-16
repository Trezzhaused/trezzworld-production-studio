export type ReleaseStatus = 'draft' | 'published' | 'archived';

export interface Release {
  id: string;
  name: string;
  version: string;
  status: ReleaseStatus;
  notes?: string;
  createdAt: string;
  publishedAt?: string;
  metadata?: Record<string, unknown>;
}

export class ReleaseManager {
  private readonly releases = new Map<string, Release>();

  create(name: string, version: string, notes?: string): Release {
    const release: Release = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name, version, status: 'draft', notes,
      createdAt: new Date().toISOString(),
    };
    this.releases.set(release.id, release);
    return { ...release };
  }

  publish(id: string): Release {
    const r = this.require(id);
    r.status = 'published';
    r.publishedAt = new Date().toISOString();
    return { ...r };
  }

  archive(id: string): Release {
    const r = this.require(id);
    r.status = 'archived';
    return { ...r };
  }

  get(id: string): Release | undefined {
    const r = this.releases.get(id);
    return r ? { ...r } : undefined;
  }

  list(status?: ReleaseStatus): Release[] {
    const all = [...this.releases.values()].map(r => ({ ...r }));
    return status ? all.filter(r => r.status === status) : all;
  }

  private require(id: string): Release {
    const r = this.releases.get(id);
    if (!r) throw new Error(`Release not found: ${id}`);
    return r;
  }
}
