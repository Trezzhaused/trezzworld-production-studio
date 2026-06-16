import { Provider, ProviderRegistry } from './ProviderRegistry';

export class ProviderSelector {
  constructor(private readonly registry: ProviderRegistry) {}

  select(capability: string): Provider | undefined {
    const candidates = this.registry.findByCapability(capability);
    return candidates.sort((left, right) => left.costRank - right.costRank)[0];
  }
}
