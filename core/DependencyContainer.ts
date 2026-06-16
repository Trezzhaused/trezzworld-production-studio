type Factory<T> = () => T;

export class DependencyContainer {
  private readonly factories = new Map<string, Factory<unknown>>();
  private readonly singletons = new Map<string, unknown>();

  bind<T>(token: string, factory: Factory<T>, singleton = true): void {
    this.factories.set(token, factory as Factory<unknown>);
    if (!singleton) this.singletons.delete(token);
  }

  resolve<T>(token: string): T {
    if (this.singletons.has(token)) return this.singletons.get(token) as T;
    const factory = this.factories.get(token);
    if (!factory) throw new Error(`Dependency not bound: ${token}`);
    const instance = factory() as T;
    this.singletons.set(token, instance);
    return instance;
  }

  has(token: string): boolean {
    return this.factories.has(token);
  }

  unbind(token: string): void {
    this.factories.delete(token);
    this.singletons.delete(token);
  }

  list(): string[] {
    return [...this.factories.keys()];
  }
}
