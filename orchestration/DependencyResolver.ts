import { MissionTask } from './Mission';

export class DependencyResolver {
  order(tasks: MissionTask[]): MissionTask[] {
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const visited = new Set<string>();
    const ordered: MissionTask[] = [];

    const visit = (task: MissionTask): void => {
      if (visited.has(task.id)) {
        return;
      }
      visited.add(task.id);
      task.dependsOn.forEach((dependencyId) => {
        const dependency = byId.get(dependencyId);
        if (dependency) {
          visit(dependency);
        }
      });
      ordered.push(task);
    };

    tasks.forEach(visit);
    return ordered;
  }
}
