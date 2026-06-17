export interface Node { id: string; type: string; deps: string[]; }

export class DependencyGraph {
  private nodes: Map<string, Node> = new Map();

  add(node: Node): void { this.nodes.set(node.id, node); }

  get(id: string): Node | undefined { return this.nodes.get(id); }

  getAll(): Node[] { return Array.from(this.nodes.values()); }

  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (id: string) => {
      if (path.includes(id)) { cycles.push([...path, id]); return; }
      if (visited.has(id)) return;
      visited.add(id);
      path.push(id);
      for (const dep of this.nodes.get(id)?.deps || []) dfs(dep);
      path.pop();
    };

    for (const id of this.nodes.keys()) dfs(id);
    return cycles;
  }
}
