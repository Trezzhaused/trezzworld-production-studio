export interface SessionModel {
  id: string;
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, unknown>;
}

export class Session {
  constructor(private model: SessionModel) {}

  getId(): string { return this.model.id; }
  getWorkspaceId(): string | undefined { return this.model.workspaceId; }
  getProjectId(): string | undefined { return this.model.projectId; }
  isActive(): boolean { return this.model.endedAt === undefined; }

  setProject(projectId: string): void { this.model.projectId = projectId; }

  end(): void {
    if (!this.model.endedAt) this.model.endedAt = new Date().toISOString();
  }

  setMetadata(key: string, value: unknown): void {
    if (!this.model.metadata) this.model.metadata = {};
    this.model.metadata[key] = value;
  }

  getModel(): SessionModel { return { ...this.model }; }

  static create(workspaceId?: string, userId?: string): Session {
    return new Session({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId, workspaceId,
      startedAt: new Date().toISOString(),
    });
  }
}
