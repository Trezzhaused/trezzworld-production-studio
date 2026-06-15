import { WorkspaceProject } from './Workspace';

export interface GraphNode {
  project: WorkspaceProject;
  dependencies: string[];
  dependents: string[];
}

export class ProjectGraph {
  private readonly nodes = new Map<string, GraphNode>();

  add(project: WorkspaceProject): void {
    if (!this.nodes.has(project.id)) {
      this.nodes.set(project.id, { project: { ...project }, dependencies: [], dependents: [] });
    }
  }

  addDependency(fromId: string, toId: string): void {
    const from = this.require(fromId);
    const to = this.require(toId);
    if (!from.dependencies.includes(toId)) from.dependencies.push(toId);
    if (!to.dependents.includes(fromId)) to.dependents.push(fromId);
  }

  get(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  buildOrder(): WorkspaceProject[] {
    const inDegree = new Map<string, number>();
    for (const [id, node] of this.nodes) inDegree.set(id, node.dependencies.length);
    const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
    const result: WorkspaceProject[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      result.push(this.nodes.get(id)!.project);
      for (const dep of this.nodes.get(id)!.dependents) {
        const deg = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, deg);
        if (deg === 0) queue.push(dep);
      }
    }
    return result;
  }

  list(): GraphNode[] {
    return [...this.nodes.values()];
  }

  private require(id: string): GraphNode {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`Project not found in graph: ${id}`);
    return n;
  }
}
