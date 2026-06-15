export interface TaskNode {
  id: string;
  name: string;
  dependsOn: string[];
}

export class TaskGraph {
  private nodes = new Map<string, TaskNode>();

  addTask(id: string, name: string, dependsOn: string[] = []): TaskNode {
    const node: TaskNode = { id, name, dependsOn };
    this.nodes.set(id, node);
    return { ...node };
  }

  getTask(id: string): TaskNode | undefined {
    const node = this.nodes.get(id);
    return node ? { ...node } : undefined;
  }

  listTasks(): TaskNode[] {
    return Array.from(this.nodes.values()).map(n => ({ ...n }));
  }

  executionOrder(): TaskNode[] {
    return this.listTasks().sort((a, b) => a.dependsOn.length - b.dependsOn.length);
  }
}
