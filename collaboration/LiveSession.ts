import { Presence } from './Presence';
import { Comments } from './Comments';
import { ConflictResolver } from './ConflictResolver';

export type LiveSessionStatus = 'active' | 'paused' | 'ended';

export interface LiveSessionModel {
  id: string;
  projectId: string;
  hostId: string;
  status: LiveSessionStatus;
  startedAt: string;
  endedAt?: string;
}

export class LiveSession {
  readonly presence = new Presence();
  readonly comments = new Comments();
  readonly conflicts = new ConflictResolver();
  private model: LiveSessionModel;

  constructor(projectId: string, hostId: string) {
    this.model = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      projectId, hostId,
      status: 'active',
      startedAt: new Date().toISOString(),
    };
    this.presence.join(hostId, this.model.id, projectId);
  }

  join(userId: string): void {
    if (this.model.status !== 'active') throw new Error('Cannot join: session is not active');
    this.presence.join(userId, this.model.id, this.model.projectId);
  }

  leave(userId: string): void { this.presence.leave(userId); }

  pause(): void { this.model.status = 'paused'; }
  resume(): void { this.model.status = 'active'; }

  end(): void {
    this.model.status = 'ended';
    this.model.endedAt = new Date().toISOString();
    for (const p of this.presence.listOnline()) this.presence.leave(p.userId);
  }

  getModel(): LiveSessionModel { return { ...this.model }; }
  getId(): string { return this.model.id; }
  isActive(): boolean { return this.model.status === 'active'; }
}
