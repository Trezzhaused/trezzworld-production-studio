import type { PluginRecord, PluginManifest } from './Plugin';

export class PluginRegistry {
  private readonly records = new Map<string, PluginRecord>();

  register(manifest: PluginManifest): void {
    if (this.records.has(manifest.id)) throw new Error(`Plugin already registered: ${manifest.id}`);
    this.records.set(manifest.id, { manifest, status: 'unloaded' });
  }

  unregister(id: string): boolean { return this.records.delete(id); }

  get(id: string): PluginRecord | undefined { return this.records.get(id); }

  setStatus(id: string, status: PluginRecord['status'], error?: string): void {
    const r = this.require(id);
    r.status = status;
    if (error) r.error = error;
    if (status === 'active') r.activatedAt = new Date().toISOString();
  }

  list(status?: PluginRecord['status']): PluginRecord[] {
    const all = [...this.records.values()];
    return status ? all.filter(r => r.status === status) : all;
  }

  has(id: string): boolean { return this.records.has(id); }

  private require(id: string): PluginRecord {
    const r = this.records.get(id);
    if (!r) throw new Error(`Plugin not found: ${id}`);
    return r;
  }
}
