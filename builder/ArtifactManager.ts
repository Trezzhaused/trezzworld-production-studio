export interface Artifact {
  id: string;
  name: string;
  type: string;
  path: string;
  sizeBytes?: number;
  createdAt: string;
  buildId?: string;
  metadata?: Record<string, unknown>;
}

export class ArtifactManager {
  private readonly artifacts = new Map<string, Artifact>();

  store(artifact: Artifact): void {
    this.artifacts.set(artifact.id, artifact);
  }

  get(id: string): Artifact | undefined { return this.artifacts.get(id); }

  remove(id: string): boolean { return this.artifacts.delete(id); }

  list(buildId?: string): Artifact[] {
    const all = [...this.artifacts.values()];
    return buildId ? all.filter(a => a.buildId === buildId) : all;
  }

  clear(): void { this.artifacts.clear(); }

  totalSize(): number {
    return [...this.artifacts.values()].reduce((sum, a) => sum + (a.sizeBytes ?? 0), 0);
  }
}
