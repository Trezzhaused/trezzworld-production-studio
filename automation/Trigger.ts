export type TriggerType = 'manual' | 'schedule' | 'event' | 'webhook' | 'condition';

export interface TriggerModel {
  id: string;
  workflowId: string;
  type: TriggerType;
  enabled: boolean;
  config?: Record<string, unknown>;
  lastFired?: string;
}

export class Trigger {
  constructor(private model: TriggerModel) {}

  getId(): string { return this.model.id; }
  getType(): TriggerType { return this.model.type; }
  getWorkflowId(): string { return this.model.workflowId; }
  isEnabled(): boolean { return this.model.enabled; }

  enable(): void { this.model.enabled = true; }
  disable(): void { this.model.enabled = false; }

  fire(): void {
    if (!this.model.enabled) throw new Error(`Trigger is disabled: ${this.model.id}`);
    this.model.lastFired = new Date().toISOString();
  }

  getModel(): TriggerModel { return { ...this.model }; }

  static create(workflowId: string, type: TriggerType, config?: Record<string, unknown>): Trigger {
    return new Trigger({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      workflowId, type, enabled: true, config,
    });
  }
}
