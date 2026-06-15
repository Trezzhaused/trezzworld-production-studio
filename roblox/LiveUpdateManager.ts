export type LiveUpdateStatus = 'idle' | 'pending-approval' | 'deploying' | 'completed' | 'failed';

export interface LiveUpdateSession {
  id: string;
  version: string;
  status: LiveUpdateStatus;
  rollbackSnapshotId?: string;
  updatedAt: string;
}

export class LiveUpdateManager {
  private sessions: LiveUpdateSession[] = [];

  start(version: string, rollbackSnapshotId?: string): LiveUpdateSession {
    const session: LiveUpdateSession = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      version,
      status: 'pending-approval',
      rollbackSnapshotId,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.push(session);
    return { ...session };
  }

  updateStatus(id: string, status: LiveUpdateStatus): LiveUpdateSession {
    const session = this.sessions.find(s => s.id === id);
    if (!session) throw new Error(`Live update session not found: ${id}`);
    session.status = status;
    session.updatedAt = new Date().toISOString();
    return { ...session };
  }

  latest(): LiveUpdateSession | undefined {
    return this.sessions.at(-1);
  }

  list(): LiveUpdateSession[] {
    return [...this.sessions];
  }
}
