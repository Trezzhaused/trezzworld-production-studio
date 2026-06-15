import { GenerationQueue } from './GenerationQueue';
import { PipelineExecutor } from './PipelineExecutor';

export type SchedulerState = 'idle' | 'running' | 'paused' | 'stopped';

export interface SchedulerStats {
  state: SchedulerState;
  ticksCompleted: number;
  jobsProcessed: number;
  jobsFailed: number;
}

export class AssetScheduler {
  private state: SchedulerState = 'idle';
  private ticksCompleted = 0;
  private jobsProcessed = 0;
  private jobsFailed = 0;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(
    private readonly queue: GenerationQueue,
    private readonly executor: PipelineExecutor,
    private readonly tickIntervalMs = 500,
  ) {}

  start(): void {
    if (this.state === 'running') return;
    this.state = 'running';
    this.intervalId = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.state = 'paused';
    clearInterval(this.intervalId);
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.intervalId = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  stop(): void {
    clearInterval(this.intervalId);
    this.state = 'stopped';
  }

  private async tick(): Promise<void> {
    if (this.queue.size() === 0) return;
    const result = await this.executor.run();
    this.ticksCompleted++;
    this.jobsProcessed += result.processed;
    this.jobsFailed += result.failed;
  }

  getStats(): SchedulerStats {
    return {
      state: this.state,
      ticksCompleted: this.ticksCompleted,
      jobsProcessed: this.jobsProcessed,
      jobsFailed: this.jobsFailed,
    };
  }
}
