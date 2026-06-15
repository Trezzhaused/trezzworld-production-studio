export interface UniverseNode {
  id: string;
  type: string;
  name: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export class UniverseGraph {
  private readonly nodes = new Map<string, UniverseNode>();
  private readonly children = new Map<string, Set<string>>();

  addNode(node: UniverseNode): void {
    if (this.nodes.has(node.id)) throw new Error(`Node already exists: ${node.id}`);
    this.nodes.set(node.id, node);
    if (node.parentId) {
      const set = this.children.get(node.parentId) ?? new Set<string>();
      set.add(node.id);
      this.children.set(node.parentId, set);
    }
  }

  getNode(id: string): UniverseNode | undefined { return this.nodes.get(id); }

  getChildren(id: string): UniverseNode[] {
    const ids = this.children.get(id) ?? new Set<string>();
    return [...ids].map(i => this.nodes.get(i)).filter((n): n is UniverseNode => n !== undefined);
  }

  removeNode(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;
    if (node.parentId) this.children.get(node.parentId)?.delete(id);
    this.children.delete(id);
    this.nodes.delete(id);
    return true;
  }

  list(): UniverseNode[] { return [...this.nodes.values()]; }
}
