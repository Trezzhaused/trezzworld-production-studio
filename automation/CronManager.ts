export interface CronJob {
  id: string;
  name: string;
  expression: string;
  enabled: boolean;
  lastRun?: string;
  execute: () => Promise<void>;
}

export class CronManager {
  private readonly jobs = new Map<string, CronJob & { handle?: ReturnType<typeof setInterval> }>();

  register(name: string, expression: string, execute: () => Promise<void>): CronJob {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const job: CronJob = { id, name, expression, enabled: true, execute };
    this.jobs.set(id, { ...job, execute });
    return { ...job };
  }

  enable(id: string): void { this.require(id).enabled = true; }
  disable(id: string): void { this.require(id).enabled = false; }

  async runNow(id: string): Promise<void> {
    const job = this.require(id);
    job.lastRun = new Date().toISOString();
    await job.execute();
  }

  startInterval(id: string, intervalMs: number): void {
    const job = this.require(id);
    if (job.handle) clearInterval(job.handle);
    job.handle = setInterval(async () => {
      if (!job.enabled) return;
      job.lastRun = new Date().toISOString();
      try { await job.execute(); } catch { /* absorb errors in cron */ }
    }, intervalMs);
  }

  stopInterval(id: string): void {
    const job = this.require(id);
    if (job.handle) { clearInterval(job.handle); job.handle = undefined; }
  }

  stopAll(): void {
    for (const id of this.jobs.keys()) this.stopInterval(id);
  }

  remove(id: string): boolean {
    this.stopInterval(id);
    return this.jobs.delete(id);
  }

  list(): Omit<CronJob, 'execute'>[] {
    return [...this.jobs.values()].map(({ execute: _e, handle: _h, ...rest }) => rest);
  }

  private require(id: string) {
    const j = this.jobs.get(id);
    if (!j) throw new Error(`CronJob not found: ${id}`);
    return j;
  }
}
