export interface SettingDefinition<T = unknown> {
  key: string;
  defaultValue: T;
  description?: string;
}

export class Settings {
  private readonly definitions = new Map<string, SettingDefinition>();
  private readonly overrides = new Map<string, unknown>();

  define<T>(def: SettingDefinition<T>): void {
    if (!this.definitions.has(def.key)) {
      this.definitions.set(def.key, def as SettingDefinition);
    }
  }

  set<T>(key: string, value: T): void {
    this.overrides.set(key, value);
  }

  get<T>(key: string): T {
    if (this.overrides.has(key)) return this.overrides.get(key) as T;
    const def = this.definitions.get(key);
    if (!def) throw new Error(`Setting not found: ${key}`);
    return def.defaultValue as T;
  }

  reset(key: string): void {
    this.overrides.delete(key);
  }

  resetAll(): void {
    this.overrides.clear();
  }

  list(): { key: string; value: unknown; isDefault: boolean }[] {
    return [...this.definitions.keys()].map(key => ({
      key,
      value: this.overrides.has(key) ? this.overrides.get(key) : this.definitions.get(key)!.defaultValue,
      isDefault: !this.overrides.has(key),
    }));
  }
}
