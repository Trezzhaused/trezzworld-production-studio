export interface Extension {
  readonly extensionId: string;
  readonly name: string;
  activate(api: ExtensionHostAPI): Promise<void>;
  deactivate?(): Promise<void>;
}

export interface ExtensionHostAPI {
  readonly extensionId: string;
  log(message: string): void;
}

export interface LoadedExtension {
  extensionId: string;
  name: string;
  active: boolean;
  activatedAt?: string;
}

export class ExtensionHost {
  private readonly extensions = new Map<string, { ext: Extension; state: LoadedExtension }>();

  register(extension: Extension): void {
    if (this.extensions.has(extension.extensionId)) throw new Error(`Extension already registered: ${extension.extensionId}`);
    this.extensions.set(extension.extensionId, {
      ext: extension,
      state: { extensionId: extension.extensionId, name: extension.name, active: false },
    });
  }

  async activate(extensionId: string): Promise<void> {
    const entry = this.require(extensionId);
    if (entry.state.active) return;
    const api: ExtensionHostAPI = {
      extensionId,
      log: (msg) => console.log(`[ext:${extensionId}] ${msg}`),
    };
    await entry.ext.activate(api);
    entry.state.active = true;
    entry.state.activatedAt = new Date().toISOString();
  }

  async deactivate(extensionId: string): Promise<void> {
    const entry = this.require(extensionId);
    if (!entry.state.active) return;
    await entry.ext.deactivate?.();
    entry.state.active = false;
  }

  async activateAll(): Promise<void> {
    for (const id of this.extensions.keys()) await this.activate(id);
  }

  async deactivateAll(): Promise<void> {
    for (const id of [...this.extensions.keys()].reverse()) await this.deactivate(id);
  }

  get(extensionId: string): LoadedExtension | undefined { return this.extensions.get(extensionId)?.state; }
  list(): LoadedExtension[] { return [...this.extensions.values()].map(e => ({ ...e.state })); }

  private require(id: string) {
    const e = this.extensions.get(id);
    if (!e) throw new Error(`Extension not found: ${id}`);
    return e;
  }
}
