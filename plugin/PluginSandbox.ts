import type { PluginContext } from './Plugin';

export interface SandboxOptions {
  timeoutMs?: number;
  allowedPermissions?: string[];
}

export class PluginSandbox {
  private readonly permissions: Set<string>;
  private readonly timeoutMs: number;

  constructor(options: SandboxOptions = {}) {
    this.permissions = new Set(options.allowedPermissions ?? []);
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  hasPermission(permission: string): boolean { return this.permissions.has(permission); }
  grantPermission(permission: string): void { this.permissions.add(permission); }
  revokePermission(permission: string): void { this.permissions.delete(permission); }
  listPermissions(): string[] { return [...this.permissions]; }

  async execute(
    pluginId: string,
    fn: (ctx: PluginContext) => Promise<void>,
    eventEmitter?: (event: string, data?: unknown) => void,
  ): Promise<void> {
    const ctx: PluginContext = {
      pluginId,
      log: (msg) => console.log(`[plugin:${pluginId}] ${msg}`),
      emit: (event, data) => eventEmitter?.(event, data),
    };
    await Promise.race([
      fn(ctx),
      new Promise<void>((_, rej) =>
        setTimeout(() => rej(new Error(`Plugin execution timeout: ${pluginId}`)), this.timeoutMs),
      ),
    ]);
  }
}
