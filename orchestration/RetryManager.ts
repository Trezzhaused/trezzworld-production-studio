import { MissionTask } from './Mission';

export class RetryManager {
  constructor(private readonly maxAttempts: number = 3) {}

  canRetry(task: MissionTask): boolean {
    return task.attempts < this.maxAttempts;
  }

  markRetry(task: MissionTask): MissionTask {
    return {
      ...task,
      attempts: task.attempts + 1,
      status: 'queued',
    };
  }
}
