import { Job, JobResult } from './Job';

export type WorkerState = 'idle' | 'busy';

export class Worker {
  private state: WorkerState = 'idle';
  readonly id: string;

  constructor(id?: string) {
    this.id = id ?? `worker-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async execute(job: Job): Promise<JobResult> {
    if (this.state === 'busy') throw new Error(`Worker ${this.id} is busy`);
    this.state = 'busy';
    const start = Date.now();
    try {
      const output = await job.execute();
      return { output, durationMs: Date.now() - start };
    } catch (err) {
      return { error: String(err), durationMs: Date.now() - start };
    } finally {
      this.state = 'idle';
    }
  }

  getState(): WorkerState {
    return this.state;
  }

  isIdle(): boolean {
    return this.state === 'idle';
  }
}
