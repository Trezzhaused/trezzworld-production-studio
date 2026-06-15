import { GenerationQueue } from './GenerationQueue';
import { GenerationContext } from './GenerationContext';
import { GeneratorRegistry, GeneratorType } from './GeneratorRegistry';
import { AssetCategory } from './AssetRequest';

export interface PipelineExecutorOptions {
  concurrency?: number;
}

export interface PipelineRunResult {
  processed: number;
  failed: number;
  completedAt: string;
}

export class PipelineExecutor {
  private readonly concurrency: number;

  constructor(
    private readonly queue: GenerationQueue,
    private readonly registry: GeneratorRegistry,
    options: PipelineExecutorOptions = {},
  ) {
    this.concurrency = options.concurrency ?? 4;
  }

  async run(): Promise<PipelineRunResult> {
    let processed = 0;
    let failed = 0;
    const slots = Math.min(this.concurrency, this.queue.size());
    const tasks: Promise<void>[] = [];

    for (let i = 0; i < slots; i++) {
      tasks.push(this.processNext().then(ok => { if (ok) processed++; else failed++; }));
    }

    await Promise.all(tasks);
    return { processed, failed, completedAt: new Date().toISOString() };
  }

  private async processNext(): Promise<boolean> {
    const job = this.queue.dequeue();
    if (!job) return false;

    const ctx = new GenerationContext(job.id, job.category as AssetCategory);
    try {
      const generator = this.registry.resolve(job.category as GeneratorType);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (generator as any).generate({ prompt: job.prompt });
      this.queue.complete(job.id, {
        assetId: result.id ?? job.id,
        assetPath: result.assetPath ?? `generated/${job.category}/${job.id}`,
        generatedAt: new Date().toISOString(),
      });
      ctx.setProgress(100);
      return true;
    } catch (err) {
      this.queue.fail(job.id, String(err));
      return false;
    }
  }
}
