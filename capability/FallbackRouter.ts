export class FallbackRouter {
  private readonly fallbacks = new Map<string, string>();

  setFallback(capability: string, fallbackCapability: string): void {
    this.fallbacks.set(capability, fallbackCapability);
  }

  resolve(capability: string): string {
    return this.fallbacks.get(capability) ?? 'generic-generator';
  }
}
