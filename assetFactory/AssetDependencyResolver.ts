import { AssetGraph } from './AssetGraph';

export interface ResolvedDependency {
  assetId: string;
  assetPath: string;
  type: string;
}

export class AssetDependencyResolver {
  constructor(private readonly graph: AssetGraph) {}

  resolve(assetId: string): ResolvedDependency[] {
    const nodes = this.graph.resolveDependencies(assetId);
    return nodes.map(n => ({ assetId: n.id, assetPath: n.assetPath, type: n.type }));
  }

  hasCircular(): boolean {
    const order = this.graph.topologicalOrder();
    return order.length !== this.graph.list().length;
  }

  getDependents(assetId: string): ResolvedDependency[] {
    const node = this.graph.get(assetId);
    if (!node) throw new Error(`Asset not found: ${assetId}`);
    return node.dependents.map(id => {
      const dep = this.graph.get(id)!;
      return { assetId: dep.id, assetPath: dep.assetPath, type: dep.type };
    });
  }
}
