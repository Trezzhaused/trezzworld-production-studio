export interface ComponentDefinition {
  id: string;
  name: string;
  category: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  factory: (props: Record<string, unknown>) => any;
}

export class ComponentRegistry {
  private readonly components = new Map<string, ComponentDefinition>();

  register(def: ComponentDefinition): void {
    if (this.components.has(def.id)) throw new Error(`Component already registered: ${def.id}`);
    this.components.set(def.id, def);
  }

  resolve(id: string): ComponentDefinition {
    const def = this.components.get(id);
    if (!def) throw new Error(`Component not found: ${id}`);
    return def;
  }

  create(id: string, props: Record<string, unknown> = {}): unknown {
    return this.resolve(id).factory(props);
  }

  list(): ComponentDefinition[] {
    return [...this.components.values()];
  }

  has(id: string): boolean {
    return this.components.has(id);
  }
}
