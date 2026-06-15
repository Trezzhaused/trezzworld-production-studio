export interface PlaytestSession {
  id: string;
  sceneId: string;
  playerCount: number;
  durationMs: number;
  events: string[];
  startedAt: string;
  endedAt?: string;
}

export interface PlaytestReport {
  sessionId: string;
  issues: string[];
  score: number;
  recommendations: string[];
}

export class PlaytestEngine {
  private readonly sessions = new Map<string, PlaytestSession>();

  start(sceneId: string, playerCount = 1): PlaytestSession {
    const session: PlaytestSession = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sceneId,
      playerCount,
      durationMs: 0,
      events: [],
      startedAt: new Date().toISOString(),
    };
    this.sessions.set(session.id, session);
    return { ...session };
  }

  recordEvent(sessionId: string, event: string): void {
    const session = this.require(sessionId);
    session.events.push(event);
  }

  end(sessionId: string): PlaytestReport {
    const session = this.require(sessionId);
    session.endedAt = new Date().toISOString();
    session.durationMs = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
    return {
      sessionId,
      issues: [],
      score: 100,
      recommendations: session.events.length === 0 ? ['No events recorded during playtest'] : [],
    };
  }

  get(sessionId: string): PlaytestSession | undefined {
    return this.sessions.get(sessionId);
  }

  private require(id: string): PlaytestSession {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`Playtest session not found: ${id}`);
    return s;
  }
}
