import type { Plugin } from './Plugin';
import { PluginRegistry } from './PluginRegistry';
import { PluginSandbox } from './PluginSandbox';

export class PluginLoader {
  constructor(
    private readonly registry: PluginRegistry,
    private readonly sandbox: PluginSandbox,
  ) {}

  async load(plugin: Plugin): Promise<void> {
    const { manifest } = plugin;
    if (!this.registry.has(manifest.id)) this.registry.register(manifest);
    this.registry.setStatus(manifest.id, 'loading');
    try {
      await this.sandbox.execute(manifest.id, (ctx) => plugin.activate(ctx));
      this.registry.setStatus(manifest.id, 'active');
    } catch (err) {
      this.registry.setStatus(manifest.id, 'error', (err as Error).message);
      throw err;
    }
  }

  async unload(plugin: Plugin): Promise<void> {
    const { id } = plugin.manifest;
    if (!this.registry.has(id)) return;
    try {
      await plugin.deactivate?.();
    } finally {
      this.registry.setStatus(id, 'inactive');
    }
  }

  async loadAll(plugins: Plugin[]): Promise<void> {
    for (const p of plugins) {
      try { await this.load(p); } catch { /* continue loading remaining plugins */ }
    }
  }
}
