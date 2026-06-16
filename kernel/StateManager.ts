export type StateScope = 'application' | 'workspace' | 'project' | 'session';

export type StateChangeListener<T = unknown> = (key: string, newValue: T, oldValue: T | undefined) => void;

export class StateManager {
  private readonly stores = new Map<StateScope, Map<string, unknown>>();
  private readonly listeners = new Map<string, Set<StateChangeListener>>();

  constructor() {
    for (const scope of ['application', 'workspace', 'project', 'session'] as StateScope[]) {
      this.stores.set(scope, new Map());
    }
  }

  set<T>(scope: StateScope, key: string, value: T): void {
    const store = this.stores.get(scope)!;
    const old = store.get(key) as T | undefined;
    store.set(key, value);
    for (const cb of this.listeners.get(`${scope}:${key}`) ?? []) cb(key, value, old);
    for (const cb of this.listeners.get(`${scope}:*`) ?? []) cb(key, value, old);
  }

  get<T>(scope: StateScope, key: string): T | undefined {
    return this.stores.get(scope)?.get(key) as T | undefined;
  }

  delete(scope: StateScope, key: string): boolean {
    return this.stores.get(scope)?.delete(key) ?? false;
  }

  clearScope(scope: StateScope): void { this.stores.get(scope)?.clear(); }

  getAll(scope: StateScope): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of this.stores.get(scope) ?? []) out[k] = v;
    return out;
  }

  on<T>(scope: StateScope, key: string, listener: StateChangeListener<T>): () => void {
    const fullKey = `${scope}:${key}`;
    const set = this.listeners.get(fullKey) ?? new Set();
    set.add(listener as StateChangeListener);
    this.listeners.set(fullKey, set);
    return () => set.delete(listener as StateChangeListener);
  }
}
