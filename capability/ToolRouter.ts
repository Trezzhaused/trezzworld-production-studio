import { ProviderRegistry } from "./ProviderRegistry";

export class ToolRouter {
  private registry = new ProviderRegistry();

  async route(capability: string, payload: Record<string, unknown>): Promise<unknown> {
    const provider = this.registry.getProvider(capability);
    if (!provider) throw new Error(`No provider for capability: ${capability}`);
    console.log(`[ToolRouter] Routing ${capability} to ${provider.name}`);
    return provider.execute(payload);
  }

  listCapabilities(): string[] { return this.registry.listCapabilities(); }
}
