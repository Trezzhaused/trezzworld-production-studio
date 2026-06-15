export interface KernelModule {
  id: string;
  initialize(): Promise<void>;
}

export class Bootstrap {
  private readonly modules: KernelModule[] = [];

  register(module: KernelModule): void {
    this.modules.push(module);
  }

  async start(): Promise<void> {
    for (const module of this.modules) {
      await module.initialize();
    }
  }
}
