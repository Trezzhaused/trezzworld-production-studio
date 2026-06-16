import type { IModule } from './types/IModule';
import type { ServiceContainer } from './ServiceContainer';

export interface LoadedModule {
  moduleId: string;
  version: string;
  loadedAt: string;
}

export class ModuleLoader {
  private readonly loaded = new Map<string, LoadedModule>();
  private readonly order: string[] = [];

  async load(module: IModule, container: ServiceContainer): Promise<void> {
    if (this.loaded.has(module.moduleId)) return;
    for (const dep of module.dependencies ?? []) {
      if (!this.loaded.has(dep)) throw new Error(`Dependency not loaded: ${dep} (required by ${module.moduleId})`);
    }
    await module.initialize(container);
    const record: LoadedModule = {
      moduleId: module.moduleId,
      version: module.version,
      loadedAt: new Date().toISOString(),
    };
    this.loaded.set(module.moduleId, record);
    this.order.push(module.moduleId);
  }

  async loadAll(modules: IModule[], container: ServiceContainer): Promise<void> {
    for (const m of modules) await this.load(m, container);
  }

  async unload(module: IModule): Promise<void> {
    if (!this.loaded.has(module.moduleId)) return;
    await module.dispose?.();
    this.loaded.delete(module.moduleId);
    const idx = this.order.indexOf(module.moduleId);
    if (idx !== -1) this.order.splice(idx, 1);
  }

  isLoaded(moduleId: string): boolean { return this.loaded.has(moduleId); }

  list(): LoadedModule[] { return [...this.loaded.values()]; }

  getLoadOrder(): string[] { return [...this.order]; }
}
