import { Engine, EngineRequest, EngineResult } from "./Engine";

export interface RuntimeSession {
  id: string;
  startedAt: string;
  active: boolean;
}

export class Runtime {
  private readonly engine = new Engine();
  private session: RuntimeSession | null = null;

  start(): RuntimeSession {
    this.session = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      startedAt: new Date().toISOString(),
      active: true,
    };
    return this.session;
  }

  async execute(request: EngineRequest): Promise<EngineResult> {
    if (!this.session) {
      this.start();
    }
    return this.engine.execute(request);
  }

  stop(): void {
    if (this.session) {
      this.session.active = false;
    }
  }

  getSession(): RuntimeSession | null {
    return this.session;
  }
}
