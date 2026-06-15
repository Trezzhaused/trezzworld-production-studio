export interface ModuleDefinition {
  id: string;
  name: string;
  version: string;
  enabled?: boolean;
  dependencies?: string[];
}

export class ModuleRegistry {
  private readonly modules = new Map<string, ModuleDefinition>();

  register(module: ModuleDefinition): void {
    if (this.modules.has(module.id)) throw new Error(`Module already registered: ${module.id}`);
    this.modules.set(module.id, { enabled: true, ...module });
  }

  get(id: string): ModuleDefinition | undefined {
    return this.modules.get(id);
  }

  enable(id: string): void {
    this.require(id).enabled = true;
  }

  disable(id: string): void {
    this.require(id).enabled = false;
  }

  isEnabled(id: string): boolean {
    return this.require(id).enabled ?? false;
  }

  list(): ModuleDefinition[] {
    return [...this.modules.values()];
  }

  private require(id: string): ModuleDefinition {
    const m = this.modules.get(id);
    if (!m) throw new Error(`Module not found: ${id}`);
    return m;
  }
}
