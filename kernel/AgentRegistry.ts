export interface AgentDefinition {
  id: string;
  role: string;
  capabilities: string[];
  enabled?: boolean;
}

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent already registered: ${agent.id}`);
    }
    this.agents.set(agent.id, { enabled: true, ...agent });
  }

  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  enable(id: string): void {
    this.require(id).enabled = true;
  }

  disable(id: string): void {
    this.require(id).enabled = false;
  }

  list(): AgentDefinition[] {
    return [...this.agents.values()];
  }

  findByCapability(capability: string): AgentDefinition[] {
    return this.list().filter(a => a.capabilities.includes(capability));
  }

  private require(id: string): AgentDefinition {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent not found: ${id}`);
    }
    return agent;
  }
}
