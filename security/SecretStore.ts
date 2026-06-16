export class SecretStore {
  private readonly secrets = new Map<string, string>();

  set(key: string, value: string): void { this.secrets.set(key, value); }

  get(key: string): string {
    const v = this.secrets.get(key);
    if (v === undefined) throw new Error(`Secret not found: ${key}`);
    return v;
  }

  tryGet(key: string): string | undefined { return this.secrets.get(key); }

  has(key: string): boolean { return this.secrets.has(key); }

  delete(key: string): boolean { return this.secrets.delete(key); }

  keys(): string[] { return [...this.secrets.keys()]; }

  clear(): void { this.secrets.clear(); }
}
