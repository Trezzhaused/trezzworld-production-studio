export interface Capability {
  id: string;
  name: string;
  description?: string;
}

export class CapabilityRegistry {
  private capabilities = new Map<string, Capability>();
  private agentCapabilities = new Map<string, Set<string>>();

  registerCapability(capability: Capability): Capability {
    this.capabilities.set(capability.id, capability);
    return { ...capability };
  }

  assignCapability(agentId: string, capabilityId: string): void {
    if (!this.agentCapabilities.has(agentId)) {
      this.agentCapabilities.set(agentId, new Set());
    }
    this.agentCapabilities.get(agentId)!.add(capabilityId);
  }

  getCapabilitiesForAgent(agentId: string): Capability[] {
    const ids = this.agentCapabilities.get(agentId) ?? new Set<string>();
    return Array.from(ids)
      .map(id => this.capabilities.get(id))
      .filter((c): c is Capability => c !== undefined)
      .map(c => ({ ...c }));
  }

  findAgentsWithCapability(capabilityId: string): string[] {
    const result: string[] = [];
    for (const [agentId, caps] of this.agentCapabilities.entries()) {
      if (caps.has(capabilityId)) result.push(agentId);
    }
    return result;
  }
}
