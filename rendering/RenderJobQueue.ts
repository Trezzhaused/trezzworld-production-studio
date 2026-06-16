export type RenderJobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed';

export interface RenderJob {
  id: string;
  projectId: string;
  status: RenderJobStatus;
  progressPercent: number;
  gpuAccelerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export class RenderJobQueue {
  private readonly jobs = new Map<string, RenderJob>();

  enqueue(projectId: string, gpuAccelerated: boolean): RenderJob {
    const timestamp = new Date().toISOString();
    const job: RenderJob = {
      id: `job-${projectId}-${Date.now()}`,
      projectId,
      status: 'queued',
      progressPercent: 0,
      gpuAccelerated,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.jobs.set(job.id, job);
    return job;
  }

  get(jobId: string): RenderJob | undefined {
    return this.jobs.get(jobId);
  }

  update(jobId: string, status: RenderJobStatus, progressPercent: number): RenderJob {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      throw new Error(`Render job not found: ${jobId}`);
    }

    const updated: RenderJob = {
      ...existing,
      status,
      progressPercent,
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, updated);
    return updated;
  }

  list(): RenderJob[] {
    return Array.from(this.jobs.values());
  }
}
