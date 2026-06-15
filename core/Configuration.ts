export type ConfigFormat = 'json' | 'env';

export class Configuration {
  private readonly data = new Map<string, unknown>();

  load(raw: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(raw)) {
      this.data.set(key, value);
    }
  }

  get<T>(key: string, fallback?: T): T {
    if (this.data.has(key)) return this.data.get(key) as T;
    if (fallback !== undefined) return fallback;
    throw new Error(`Configuration key not found: ${key}`);
  }

  set<T>(key: string, value: T): void {
    this.data.set(key, value);
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  toObject(): Record<string, unknown> {
    return Object.fromEntries(this.data);
  }

  merge(other: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(other)) {
      this.data.set(key, value);
    }
  }
}
