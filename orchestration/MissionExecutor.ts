import { BaseAgent } from '../agent/BaseAgent';
import { DependencyResolver } from './DependencyResolver';
import { MissionState, MissionTask } from './Mission';
import { ResourceAllocator } from './ResourceAllocator';
import { RetryManager } from './RetryManager';
import { TaskScheduler } from './TaskScheduler';

export class MissionExecutor {
  private readonly scheduler = new TaskScheduler();
  private readonly dependencies = new DependencyResolver();
  private readonly allocator = new ResourceAllocator();
  private readonly retry = new RetryManager();

  run(mission: MissionState, agents: Record<string, BaseAgent>): MissionState {
    const ordered = this.dependencies.order(mission.tasks);
    const scheduled = this.scheduler.schedule(ordered);
    const allocations = this.allocator.allocate(scheduled);

    const updated = scheduled.map((task) => this.executeTask(task, allocations, agents));

    return {
      ...mission,
      tasks: updated,
      status: updated.every((task) => task.status === 'done') ? 'completed' : 'running',
      iteration: mission.iteration + 1,
    };
  }

  private executeTask(
    task: MissionTask,
    allocations: Array<{ taskId: string; agentRole: string }>,
    agents: Record<string, BaseAgent>,
  ): MissionTask {
    if (task.status === 'done') {
      return task;
    }

    const allocation = allocations.find((item) => item.taskId === task.id);
    const agent = allocation ? agents[allocation.agentRole] : undefined;

    if (!agent) {
      return { ...task, status: 'error', attempts: task.attempts + 1 };
    }

    try {
      agent.execute(task);
      return { ...task, status: 'done' };
    } catch {
      if (this.retry.canRetry(task)) {
        return this.retry.markRetry(task);
      }
      return { ...task, status: 'error' };
    }
  }
}
