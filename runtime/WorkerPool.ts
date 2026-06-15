import { Worker } from './Worker';
import { Job } from './Job';

export class WorkerPool {
  private readonly workers: Worker[] = [];

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      this.workers.push(new Worker(`worker-${i}`));
    }
  }

  availableWorkers(): number {
    return this.workers.filter(w => w.isIdle()).length;
  }

  async dispatch(job: Job): Promise<void> {
    const worker = this.workers.find(w => w.isIdle());
    if (!worker) throw new Error('No available workers');
    await worker.execute(job);
  }

  getWorker(id: string): Worker | undefined {
    return this.workers.find(w => w.id === id);
  }

  list(): { id: string; state: string }[] {
    return this.workers.map(w => ({ id: w.id, state: w.getState() }));
  }

  size(): number {
    return this.workers.length;
  }
}
