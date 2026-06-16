export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ScheduledJob {
  id: string;
  name: string;
  intervalMs?: number;
  runOnce?: boolean;
  execute: () => Promise<void>;
}

interface JobState {
  job: ScheduledJob;
  status: JobStatus;
  lastRun?: Date;
  handle?: ReturnType<typeof setInterval>;
}

export class Scheduler {
  private readonly jobs = new Map<string, JobState>();

  register(job: ScheduledJob): void {
    if (this.jobs.has(job.id)) throw new Error(`Job already registered: ${job.id}`);
    this.jobs.set(job.id, { job, status: 'pending' });
  }

  start(id: string): void {
    const state = this.require(id);
    if (state.status === 'running') return;
    state.status = 'running';
    const run = async () => {
      state.lastRun = new Date();
      try {
        await state.job.execute();
        if (state.job.runOnce) { state.status = 'completed'; this.stop(id); }
      } catch { state.status = 'failed'; this.stop(id); }
    };
    if (state.job.intervalMs !== undefined) {
      state.handle = setInterval(run, state.job.intervalMs);
    }
    void run();
  }

  startAll(): void {
    for (const id of this.jobs.keys()) this.start(id);
  }

  stop(id: string): void {
    const state = this.require(id);
    if (state.handle !== undefined) { clearInterval(state.handle); state.handle = undefined; }
    if (state.status === 'running') state.status = 'cancelled';
  }

  stopAll(): void {
    for (const id of this.jobs.keys()) this.stop(id);
  }

  async runOnce(id: string): Promise<void> {
    const state = this.require(id);
    state.lastRun = new Date();
    try {
      await state.job.execute();
      state.status = 'completed';
    } catch (e) {
      state.status = 'failed';
      throw e;
    }
  }

  getStatus(id: string): JobStatus { return this.require(id).status; }

  list(): { id: string; name: string; status: JobStatus; lastRun?: Date }[] {
    return [...this.jobs.values()].map(s => ({
      id: s.job.id,
      name: s.job.name,
      status: s.status,
      lastRun: s.lastRun,
    }));
  }

  private require(id: string): JobState {
    const s = this.jobs.get(id);
    if (!s) throw new Error(`Job not found: ${id}`);
    return s;
  }
}
