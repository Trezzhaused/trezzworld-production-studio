export class ServiceLocator {
  private static instance?: ServiceLocator;
  private readonly services = new Map<string, unknown>();

  static getInstance(): ServiceLocator {
    if (!ServiceLocator.instance) ServiceLocator.instance = new ServiceLocator();
    return ServiceLocator.instance;
  }

  register<T>(id: string, instance: T): void {
    if (this.services.has(id)) throw new Error(`Service already registered: ${id}`);
    this.services.set(id, instance);
  }

  resolve<T>(id: string): T {
    const svc = this.services.get(id);
    if (!svc) throw new Error(`Service not found: ${id}`);
    return svc as T;
  }

  has(id: string): boolean {
    return this.services.has(id);
  }

  unregister(id: string): boolean {
    return this.services.delete(id);
  }

  list(): string[] {
    return [...this.services.keys()];
  }

  reset(): void {
    this.services.clear();
    ServiceLocator.instance = undefined;
  }
}
