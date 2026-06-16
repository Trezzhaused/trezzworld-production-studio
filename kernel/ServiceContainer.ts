export type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

type Factory<T> = (container: ServiceContainer) => T;

interface Registration<T> {
  lifetime: ServiceLifetime;
  factory: Factory<T>;
  instance?: T;
}

export class ServiceContainer {
  private readonly registry = new Map<string, Registration<unknown>>();
  private readonly scopedInstances = new Map<string, unknown>();

  register<T>(token: string, factory: Factory<T>, lifetime: ServiceLifetime = 'singleton'): void {
    if (this.registry.has(token)) throw new Error(`Service already registered: ${token}`);
    this.registry.set(token, { lifetime, factory } as Registration<unknown>);
  }

  registerInstance<T>(token: string, instance: T): void {
    if (this.registry.has(token)) throw new Error(`Service already registered: ${token}`);
    this.registry.set(token, { lifetime: 'singleton', factory: () => instance, instance } as Registration<unknown>);
  }

  resolve<T>(token: string): T {
    const reg = this.registry.get(token);
    if (!reg) throw new Error(`Service not found: ${token}`);
    if (reg.lifetime === 'singleton') {
      if (reg.instance === undefined) reg.instance = reg.factory(this);
      return reg.instance as T;
    }
    if (reg.lifetime === 'scoped') {
      if (!this.scopedInstances.has(token)) this.scopedInstances.set(token, reg.factory(this));
      return this.scopedInstances.get(token) as T;
    }
    return reg.factory(this) as T;
  }

  has(token: string): boolean { return this.registry.has(token); }

  list(): string[] { return [...this.registry.keys()]; }

  beginScope(): ServiceContainer {
    const scoped = new ServiceContainer();
    for (const [k, v] of this.registry) {
      scoped.registry.set(k, { ...v });
    }
    return scoped;
  }

  clearScope(): void { this.scopedInstances.clear(); }
}
