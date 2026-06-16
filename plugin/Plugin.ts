export type PluginStatus = 'unloaded' | 'loading' | 'active' | 'inactive' | 'error';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  entryPoint: string;
  permissions?: string[];
  dependencies?: string[];
}

export interface PluginContext {
  pluginId: string;
  log(message: string): void;
  emit(event: string, data?: unknown): void;
}

export interface Plugin {
  readonly manifest: PluginManifest;
  activate(ctx: PluginContext): Promise<void>;
  deactivate?(): Promise<void>;
}

export interface PluginRecord {
  manifest: PluginManifest;
  status: PluginStatus;
  activatedAt?: string;
  error?: string;
}
