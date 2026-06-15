import { Job, JobStatus } from './Job';

export interface JobRecord {
  jobId: string;
  name: string;
  status: JobStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

export class ExecutionMonitor {
  private readonly records = new Map<string, JobRecord>();

  track(job: Job): void {
    this.records.set(job.id, {
      jobId: job.id,
      name: job.name,
      status: job.status,
      startedAt: job.startedAt,
    });
  }

  update(jobId: string, status: JobStatus, durationMs?: number, error?: string): void {
    const record = this.records.get(jobId);
    if (!record) throw new Error(`Job not tracked: ${jobId}`);
    record.status = status;
    if (status === 'completed' || status === 'failed') {
      record.completedAt = new Date().toISOString();
      record.durationMs = durationMs;
      record.error = error;
    }
  }

  get(jobId: string): JobRecord | undefined {
    return this.records.get(jobId);
  }

  getByStatus(status: JobStatus): JobRecord[] {
    return [...this.records.values()].filter(r => r.status === status);
  }

  summary(): { total: number; completed: number; failed: number; running: number } {
    const all = [...this.records.values()];
    return {
      total: all.length,
      completed: all.filter(r => r.status === 'completed').length,
      failed: all.filter(r => r.status === 'failed').length,
      running: all.filter(r => r.status === 'running').length,
    };
  }

  clear(): void {
    this.records.clear();
  }
}
