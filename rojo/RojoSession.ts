export type SessionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface SessionStatus {
  state: SessionState;
  authenticated: boolean;
  lastHeartbeat?: string;
}

export class RojoSession {
  private status: SessionStatus = {
    state: 'disconnected',
    authenticated: false,
  };

  connect(): SessionStatus {
    this.status = {
      state: 'connected',
      authenticated: true,
      lastHeartbeat: new Date().toISOString(),
    };
    return this.status;
  }

  heartbeat(): void {
    if (this.status.authenticated) {
      this.status.lastHeartbeat = new Date().toISOString();
    }
  }

  disconnect(): SessionStatus {
    this.status = {
      state: 'disconnected',
      authenticated: false,
    };
    return this.status;
  }

  getStatus(): SessionStatus {
    return { ...this.status };
  }
}
