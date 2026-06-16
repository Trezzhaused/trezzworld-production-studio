import { MissionTask } from './Mission';

export class TaskScheduler {
  schedule(tasks: MissionTask[]): MissionTask[] {
    return tasks.map((task) => ({
      ...task,
      status: task.dependsOn.length === 0 ? 'scheduled' : task.status,
    }));
  }

  nextReady(tasks: MissionTask[]): MissionTask[] {
    const done = new Set(tasks.filter((task) => task.status === 'done').map((task) => task.id));
    return tasks.filter((task) => task.status === 'queued' && task.dependsOn.every((dep) => done.has(dep)));
  }
}
