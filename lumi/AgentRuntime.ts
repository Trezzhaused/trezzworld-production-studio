export type AgentState = 'idle' | 'running' | 'paused' | 'stopped';

export interface AgentTask {
  id: string;
  name: string;
  createdAt: string;
}

export class AgentRuntime {
  private state: AgentState = 'idle';
  private tasks: AgentTask[] = [];

  start(): AgentState {
    this.state = 'running';
    return this.state;
  }

  stop(): AgentState {
    this.state = 'stopped';
    return this.state;
  }

  enqueue(name: string): AgentTask {
    const task: AgentTask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      createdAt: new Date().toISOString(),
    };
    this.tasks.push(task);
    return { ...task };
  }

  getState(): AgentState {
    return this.state;
  }

  listTasks(): AgentTask[] {
    return [...this.tasks];
  }
}
