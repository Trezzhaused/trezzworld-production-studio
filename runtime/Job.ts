export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobResult {
  output?: unknown;
  error?: string;
  durationMs: number;
}

export interface Job {
  id: string;
  name: string;
  priority: number;
  status: JobStatus;
  result?: JobResult;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  execute: () => Promise<unknown>;
}

export class JobFactory {
  create(name: string, execute: () => Promise<unknown>, priority = 0): Job {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      execute,
    };
  }
}
