import { RenderArtifact, TimelineClip } from '../orchestration/ProductionContracts';
import { RenderJob, RenderJobQueue } from './RenderJobQueue';

export interface RenderOptions {
  useGpuWhenAvailable: boolean;
  allowResume: boolean;
  batchSize: number;
}

export class RenderEngine {
  constructor(private readonly queue: RenderJobQueue = new RenderJobQueue()) {}

  submit(projectId: string, options: RenderOptions): RenderJob {
    return this.queue.enqueue(projectId, options.useGpuWhenAvailable);
  }

  run(jobId: string, timeline: TimelineClip[]): RenderJob {
    this.queue.update(jobId, 'running', 10);

    const weighted = timeline.reduce((total, clip) => total + Math.max(1, clip.durationSeconds), 0);
    const progress = Math.min(100, 10 + Math.floor(weighted / 5));

    return this.queue.update(jobId, 'completed', progress);
  }

  resume(jobId: string): RenderJob {
    const job = this.queue.get(jobId);
    if (!job) {
      throw new Error(`Render job not found: ${jobId}`);
    }

    if (job.status !== 'paused' && job.status !== 'failed') {
      return job;
    }

    return this.queue.update(jobId, 'running', Math.max(20, job.progressPercent));
  }

  batchRender(projectId: string, timelines: TimelineClip[][], options: RenderOptions): RenderJob[] {
    return timelines.slice(0, Math.max(1, options.batchSize)).map((timeline, index) => {
      const job = this.submit(`${projectId}-batch-${index + 1}`, options);
      return this.run(job.id, timeline);
    });
  }

  buildArtifacts(projectId: string): RenderArtifact[] {
    return [
      {
        id: `${projectId}-render-4k`,
        target: '4k',
        resolution: '3840x2160',
        format: 'mp4',
        path: `exports/${projectId}/render-4k.mp4`,
      },
    ];
  }
}
