export interface AssetNode {
  id: string;
  type: string;
  assetPath: string;
  dependencies: string[];
  dependents: string[];
  metadata: Record<string, unknown>;
}

export class AssetGraph {
  private readonly nodes = new Map<string, AssetNode>();

  add(id: string, type: string, assetPath: string, metadata: Record<string, unknown> = {}): AssetNode {
    if (this.nodes.has(id)) throw new Error(`Asset node already exists: ${id}`);
    const node: AssetNode = { id, type, assetPath, dependencies: [], dependents: [], metadata };
    this.nodes.set(id, node);
    return { ...node };
  }

  addDependency(fromId: string, toId: string): void {
    const from = this.require(fromId);
    const to = this.require(toId);
    if (!from.dependencies.includes(toId)) from.dependencies.push(toId);
    if (!to.dependents.includes(fromId)) to.dependents.push(fromId);
  }

  get(id: string): AssetNode | undefined {
    return this.nodes.get(id);
  }

  resolveDependencies(id: string): AssetNode[] {
    const visited = new Set<string>();
    const result: AssetNode[] = [];
    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = this.require(nodeId);
      for (const dep of node.dependencies) visit(dep);
      result.push(node);
    };
    visit(id);
    return result;
  }

  topologicalOrder(): AssetNode[] {
    const inDegree = new Map<string, number>();
    for (const node of this.nodes.values()) inDegree.set(node.id, node.dependencies.length);
    const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
    const result: AssetNode[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      result.push(this.nodes.get(id)!);
      for (const dep of this.nodes.get(id)!.dependents) {
        const deg = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, deg);
        if (deg === 0) queue.push(dep);
      }
    }
    return result;
  }

  list(): AssetNode[] {
    return [...this.nodes.values()];
  }

  private require(id: string): AssetNode {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`Asset node not found: ${id}`);
    return n;
  }
}
