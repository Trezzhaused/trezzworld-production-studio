export interface SpawnRule {
  id: string;
  entityId: string;
  spawnType: 'npc' | 'item' | 'obstacle' | 'hazard';
  maxCount: number;
  respawnDelayMs: number;
  regionId?: string;
  active: boolean;
}

export interface SpawnEvent {
  ruleId: string;
  entityId: string;
  spawnedAt: string;
}

export class SpawnSystem {
  private readonly rules = new Map<string, SpawnRule>();
  private readonly events: SpawnEvent[] = [];

  addRule(rule: SpawnRule): void {
    this.rules.set(rule.id, { ...rule });
  }

  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  trigger(ruleId: string): SpawnEvent {
    const rule = this.rules.get(ruleId);
    if (!rule) throw new Error(`Spawn rule not found: ${ruleId}`);
    if (!rule.active) throw new Error(`Spawn rule is inactive: ${ruleId}`);
    const event: SpawnEvent = {
      ruleId,
      entityId: rule.entityId,
      spawnedAt: new Date().toISOString(),
    };
    this.events.push(event);
    return { ...event };
  }

  listRules(): SpawnRule[] {
    return [...this.rules.values()].map(r => ({ ...r }));
  }

  listEvents(): SpawnEvent[] {
    return [...this.events];
  }
}
