import { Job, JobFactory } from './Job';
import { JobQueue } from './JobQueue';

export interface DispatchOptions {
  priority?: number;
  name?: string;
}

export class TaskDispatcher {
  private readonly factory = new JobFactory();

  constructor(private readonly queue: JobQueue) {}

  dispatch(execute: () => Promise<unknown>, options: DispatchOptions = {}): Job {
    const job = this.factory.create(options.name ?? 'task', execute, options.priority ?? 0);
    this.queue.enqueue(job);
    return job;
  }

  dispatchBatch(tasks: Array<{ execute: () => Promise<unknown>; options?: DispatchOptions }>): Job[] {
    return tasks.map(t => this.dispatch(t.execute, t.options));
  }

  cancel(jobId: string): boolean {
    return this.queue.remove(jobId);
  }

  pendingCount(): number {
    return this.queue.size();
  }
}
