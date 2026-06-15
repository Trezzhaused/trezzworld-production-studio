export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  capabilities: string[];
  confidence: number;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): SkillDefinition {
    this.skills.set(skill.id, skill);
    return skill;
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  list(): SkillDefinition[] {
    return [...this.skills.values()];
  }

  findByCapability(capability: string): SkillDefinition[] {
    return [...this.skills.values()].filter(s => s.enabled && s.capabilities.includes(capability));
  }

  update(id: string, patch: Partial<SkillDefinition>): SkillDefinition | undefined {
    const existing = this.skills.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.skills.set(id, updated);
    return updated;
  }

  unregister(id: string): boolean {
    return this.skills.delete(id);
  }
}
