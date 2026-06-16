export class CapabilityRegistry {
  private readonly capabilities = new Set<string>();

  register(name: string): void {
    this.capabilities.add(name);
  }

  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  list(): string[] {
    return Array.from(this.capabilities).sort();
  }
}
