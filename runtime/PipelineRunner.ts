import { Job } from './Job';
import { JobQueue } from './JobQueue';
import { WorkerPool } from './WorkerPool';

export interface PipelineStage {
  name: string;
  execute: (input: unknown) => Promise<unknown>;
}

export interface PipelineRunResult {
  success: boolean;
  output: unknown;
  stagesCompleted: number;
  durationMs: number;
}

export class PipelineRunner {
  private readonly stages: PipelineStage[] = [];

  constructor(
    readonly queue: JobQueue,
    readonly pool: WorkerPool,
  ) {}

  addStage(stage: PipelineStage): void {
    this.stages.push(stage);
  }

  async run(input: unknown): Promise<PipelineRunResult> {
    const start = Date.now();
    let current = input;
    let stagesCompleted = 0;
    try {
      for (const stage of this.stages) {
        current = await stage.execute(current);
        stagesCompleted++;
      }
      return { success: true, output: current, stagesCompleted, durationMs: Date.now() - start };
    } catch {
      return { success: false, output: current, stagesCompleted, durationMs: Date.now() - start };
    }
  }

  stageCount(): number {
    return this.stages.length;
  }
}
