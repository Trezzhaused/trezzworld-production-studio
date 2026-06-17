export interface Provider {
  name: string;
  capability: string;
  status: "ready" | "standby" | "needs-provider";
  execute(payload: Record<string, unknown>): Promise<unknown>;
}

export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  register(provider: Provider): void {
    this.providers.set(provider.capability, provider);
    console.log(`[ProviderRegistry] Registered: ${provider.name} for ${provider.capability}`);
  }

  getProvider(capability: string): Provider | undefined {
    return this.providers.get(capability);
  }

  listCapabilities(): string[] { return Array.from(this.providers.keys()); }

  getAll(): Provider[] { return Array.from(this.providers.values()); }
}
