import { AgentRuntime, AgentTask } from './AgentRuntime';

export interface Session {
  id: string;
  agentId: string;
  startedAt: string;
  endedAt?: string;
  tasks: AgentTask[];
  metadata: Record<string, unknown>;
}

export class SessionManager {
  private readonly sessions = new Map<string, Session>();
  private readonly runtimes = new Map<string, AgentRuntime>();

  start(agentId: string, metadata: Record<string, unknown> = {}): Session {
    const runtime = new AgentRuntime();
    runtime.start();
    const session: Session = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      agentId,
      startedAt: new Date().toISOString(),
      tasks: [],
      metadata,
    };
    this.sessions.set(session.id, session);
    this.runtimes.set(session.id, runtime);
    return { ...session };
  }

  end(sessionId: string): Session {
    const session = this.require(sessionId);
    const runtime = this.runtimes.get(sessionId)!;
    runtime.stop();
    session.endedAt = new Date().toISOString();
    session.tasks = runtime.listTasks();
    return { ...session };
  }

  enqueueTask(sessionId: string, taskName: string): AgentTask {
    this.require(sessionId);
    const runtime = this.runtimes.get(sessionId)!;
    return runtime.enqueue(taskName);
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  list(): Session[] {
    return [...this.sessions.values()].map(s => ({ ...s }));
  }

  private require(id: string): Session {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`Session not found: ${id}`);
    return s;
  }
}
