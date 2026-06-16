import { GenerationJob, GenerationJobFactory, GenerationJobResult } from './GenerationJob';
import { AssetCategory } from './AssetRequest';

export class GenerationQueue {
  private readonly jobs = new Map<string, GenerationJob>();
  private readonly factory = new GenerationJobFactory();
  private readonly pending: string[] = [];

  enqueue(category: AssetCategory, prompt: string, priority = 0): GenerationJob {
    const job = this.factory.create(category, prompt, priority);
    this.jobs.set(job.id, job);
    this.insertByPriority(job.id, priority);
    return { ...job };
  }

  dequeue(): GenerationJob | undefined {
    const id = this.pending.shift();
    if (!id) return undefined;
    const job = this.jobs.get(id)!;
    const started = this.factory.start(job);
    this.jobs.set(id, started);
    return { ...started };
  }

  complete(id: string, result: GenerationJobResult): GenerationJob {
    const job = this.require(id);
    const done = this.factory.complete(job, result);
    this.jobs.set(id, done);
    return { ...done };
  }

  fail(id: string, error: string): GenerationJob {
    const job = this.require(id);
    const failed = this.factory.fail(job, error);
    this.jobs.set(id, failed);
    return { ...failed };
  }

  get(id: string): GenerationJob | undefined {
    return this.jobs.get(id);
  }

  listPending(): GenerationJob[] {
    return this.pending.map(id => ({ ...this.jobs.get(id)! }));
  }

  size(): number {
    return this.pending.length;
  }

  private insertByPriority(id: string, priority: number): void {
    const idx = this.pending.findIndex(pid => (this.jobs.get(pid)?.priority ?? 0) < priority);
    if (idx === -1) this.pending.push(id);
    else this.pending.splice(idx, 0, id);
  }

  private require(id: string): GenerationJob {
    const j = this.jobs.get(id);
    if (!j) throw new Error(`Job not found: ${id}`);
    return j;
  }
}
