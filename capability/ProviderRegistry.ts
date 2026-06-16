export type ProviderKind = 'local' | 'cloud' | 'commercial' | 'open-source' | 'future';

export interface Provider {
  id: string;
  kind: ProviderKind;
  capabilities: string[];
  healthy: boolean;
  costRank: number;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, Provider>();

  register(provider: Provider): void {
    this.providers.set(provider.id, provider);
  }

  list(): Provider[] {
    return Array.from(this.providers.values());
  }

  findByCapability(capability: string): Provider[] {
    return this.list().filter((provider) => provider.healthy && provider.capabilities.includes(capability));
  }
}
