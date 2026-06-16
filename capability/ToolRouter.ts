import { ProviderSelector } from './ProviderSelector';

export interface RoutingDecision {
  capability: string;
  providerId?: string;
  route: 'direct' | 'fallback';
}

export class ToolRouter {
  constructor(private readonly selector: ProviderSelector) {}

  route(capability: string): RoutingDecision {
    const provider = this.selector.select(capability);
    if (provider) {
      return { capability, providerId: provider.id, route: 'direct' };
    }

    return { capability, route: 'fallback' };
  }
}
