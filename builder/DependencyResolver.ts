export interface Dependency {
  name: string;
  version: string;
  deps?: string[];
}

export class DependencyResolver {
  private readonly graph = new Map<string, Dependency>();

  add(dep: Dependency): void { this.graph.set(dep.name, dep); }

  remove(name: string): boolean { return this.graph.delete(name); }

  resolve(name: string): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const visit = (n: string) => {
      if (visited.has(n)) return;
      visited.add(n);
      const node = this.graph.get(n);
      if (!node) throw new Error(`Dependency not found: ${n}`);
      for (const d of node.deps ?? []) visit(d);
      order.push(n);
    };
    visit(name);
    return order;
  }

  resolveAll(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const visit = (n: string) => {
      if (visited.has(n)) return;
      visited.add(n);
      const node = this.graph.get(n)!;
      for (const d of node.deps ?? []) visit(d);
      order.push(n);
    };
    for (const name of this.graph.keys()) visit(name);
    return order;
  }

  list(): Dependency[] { return [...this.graph.values()]; }

  has(name: string): boolean { return this.graph.has(name); }
}
