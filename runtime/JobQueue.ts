import { Job } from './Job';

export class JobQueue {
  private readonly jobs = new Map<string, Job>();
  private readonly pending: string[] = [];

  enqueue(job: Job): void {
    this.jobs.set(job.id, job);
    const idx = this.pending.findIndex(id => (this.jobs.get(id)?.priority ?? 0) < job.priority);
    if (idx === -1) this.pending.push(job.id);
    else this.pending.splice(idx, 0, job.id);
  }

  dequeue(): Job | undefined {
    const id = this.pending.shift();
    return id ? this.jobs.get(id) : undefined;
  }

  peek(): Job | undefined {
    const id = this.pending[0];
    return id ? this.jobs.get(id) : undefined;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  remove(id: string): boolean {
    const idx = this.pending.indexOf(id);
    if (idx !== -1) this.pending.splice(idx, 1);
    return this.jobs.delete(id);
  }

  size(): number {
    return this.pending.length;
  }

  drain(): Job[] {
    const result: Job[] = [];
    let job = this.dequeue();
    while (job) { result.push(job); job = this.dequeue(); }
    return result;
  }
}
