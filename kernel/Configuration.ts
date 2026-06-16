export interface ConfigurationRecord {
  [key: string]: unknown;
}

export class Configuration {
  private data: ConfigurationRecord = {};

  load(record: ConfigurationRecord): void {
    this.data = { ...this.data, ...record };
  }

  get<T = unknown>(key: string, defaultValue?: T): T {
    const keys = key.split('.');
    let cur: unknown = this.data;
    for (const k of keys) {
      if (cur === null || typeof cur !== 'object') return defaultValue as T;
      cur = (cur as Record<string, unknown>)[k];
    }
    return (cur === undefined ? defaultValue : cur) as T;
  }

  set(key: string, value: unknown): void {
    const keys = key.split('.');
    let cur: Record<string, unknown> = this.data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {};
      cur = cur[keys[i]] as Record<string, unknown>;
    }
    cur[keys[keys.length - 1]] = value;
  }

  has(key: string): boolean { return this.get(key) !== undefined; }

  all(): ConfigurationRecord { return { ...this.data }; }

  clear(): void { this.data = {}; }
}
