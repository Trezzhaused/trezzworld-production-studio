export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  activate: () => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

export class PluginHost {
  private readonly plugins = new Map<string, PluginDefinition>();
  private readonly active = new Set<string>();

  register(plugin: PluginDefinition): void {
    if (this.plugins.has(plugin.id)) throw new Error(`Plugin already registered: ${plugin.id}`);
    this.plugins.set(plugin.id, plugin);
  }

  async activate(id: string): Promise<void> {
    const plugin = this.require(id);
    if (this.active.has(id)) return;
    await plugin.activate();
    this.active.add(id);
  }

  async deactivate(id: string): Promise<void> {
    const plugin = this.require(id);
    if (!this.active.has(id)) return;
    await plugin.deactivate?.();
    this.active.delete(id);
  }

  isActive(id: string): boolean {
    return this.active.has(id);
  }

  list(): PluginDefinition[] {
    return [...this.plugins.values()];
  }

  listActive(): string[] {
    return [...this.active];
  }

  private require(id: string): PluginDefinition {
    const p = this.plugins.get(id);
    if (!p) throw new Error(`Plugin not found: ${id}`);
    return p;
  }
}
