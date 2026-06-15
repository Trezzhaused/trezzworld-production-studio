import { Job } from './Job';
import { JobQueue } from './JobQueue';
import { WorkerPool } from './WorkerPool';

export type SchedulerPolicy = 'fifo' | 'priority' | 'roundRobin';

export interface SchedulerStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export class Scheduler {
  private running = 0;
  private completed = 0;
  private failed = 0;
  private active = false;

  constructor(
    private readonly queue: JobQueue,
    private readonly pool: WorkerPool,
    readonly policy: SchedulerPolicy = 'priority',
  ) {}

  start(): void { this.active = true; }
  stop(): void { this.active = false; }

  async tick(): Promise<void> {
    if (!this.active) return;
    while (this.queue.size() > 0 && this.pool.availableWorkers() > 0) {
      const job = this.queue.dequeue();
      if (!job) break;
      this.running++;
      this.pool.dispatch(job).then(() => {
        this.running--;
        this.completed++;
      }).catch(() => {
        this.running--;
        this.failed++;
      });
    }
  }

  getStats(): SchedulerStats {
    return { pending: this.queue.size(), running: this.running, completed: this.completed, failed: this.failed };
  }
}
