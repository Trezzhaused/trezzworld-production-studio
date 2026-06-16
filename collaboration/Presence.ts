export interface PresenceRecord {
  userId: string;
  sessionId?: string;
  projectId?: string;
  cursor?: { line: number; col: number; file?: string };
  lastSeen: string;
  online: boolean;
}

export class Presence {
  private readonly records = new Map<string, PresenceRecord>();

  join(userId: string, sessionId?: string, projectId?: string): void {
    this.records.set(userId, {
      userId, sessionId, projectId,
      lastSeen: new Date().toISOString(),
      online: true,
    });
  }

  leave(userId: string): void {
    const r = this.records.get(userId);
    if (r) { r.online = false; r.lastSeen = new Date().toISOString(); }
  }

  updateCursor(userId: string, cursor: PresenceRecord['cursor']): void {
    const r = this.require(userId);
    r.cursor = cursor;
    r.lastSeen = new Date().toISOString();
  }

  get(userId: string): PresenceRecord | undefined { return this.records.get(userId); }

  listOnline(): PresenceRecord[] { return [...this.records.values()].filter(r => r.online); }

  list(): PresenceRecord[] { return [...this.records.values()]; }

  private require(userId: string): PresenceRecord {
    const r = this.records.get(userId);
    if (!r) throw new Error(`Presence record not found for user: ${userId}`);
    return r;
  }
}
