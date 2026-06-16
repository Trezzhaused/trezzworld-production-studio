export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export type QueuedJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface QueuedJob {
  id: string;
  name: string;
  priority: JobPriority;
  status: QueuedJobStatus;
  payload?: unknown;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  execute: () => Promise<void>;
}

const PRIORITY_ORDER: Record<JobPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

export class JobQueue {
  private readonly queue: QueuedJob[] = [];
  private running = false;
  private concurrency: number;
  private activeJobs = 0;

  constructor(concurrency = 1) { this.concurrency = concurrency; }

  enqueue(name: string, execute: () => Promise<void>, priority: JobPriority = 'normal', payload?: unknown): QueuedJob {
    const job: QueuedJob = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name, priority, status: 'queued',
      payload, createdAt: new Date().toISOString(),
      execute,
    };
    this.queue.push(job);
    this.queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    return { ...job, execute };
  }

  async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.some(j => j.status === 'queued')) {
      const pending = this.queue.filter(j => j.status === 'queued');
      const slots = this.concurrency - this.activeJobs;
      const batch = pending.slice(0, slots);
      await Promise.all(batch.map(j => this.runJob(j)));
    }
    this.running = false;
  }

  cancel(id: string): void {
    const j = this.queue.find(x => x.id === id);
    if (j && j.status === 'queued') j.status = 'cancelled';
  }

  list(status?: QueuedJobStatus): Omit<QueuedJob, 'execute'>[] {
    return this.queue
      .filter(j => !status || j.status === status)
      .map(({ execute: _e, ...rest }) => rest);
  }

  private async runJob(job: QueuedJob): Promise<void> {
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    this.activeJobs++;
    try {
      await job.execute();
      job.status = 'completed';
    } catch (err) {
      job.status = 'failed';
      job.error = (err as Error).message;
    } finally {
      job.completedAt = new Date().toISOString();
      this.activeJobs--;
    }
  }
}
