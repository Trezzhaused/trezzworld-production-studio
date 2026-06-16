export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
  dependsOn?: string[];
}

export interface WorkflowModel {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export class Workflow {
  constructor(private model: WorkflowModel) {}

  getId(): string { return this.model.id; }
  getName(): string { return this.model.name; }
  getStatus(): WorkflowStatus { return this.model.status; }

  addStep(step: WorkflowStep): void {
    if (this.model.steps.some(s => s.id === step.id)) throw new Error(`Step already exists: ${step.id}`);
    this.model.steps.push(step);
    this.model.updatedAt = new Date().toISOString();
  }

  removeStep(id: string): boolean {
    const before = this.model.steps.length;
    this.model.steps = this.model.steps.filter(s => s.id !== id);
    if (this.model.steps.length !== before) {
      this.model.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  activate(): void { this.model.status = 'active'; this.model.updatedAt = new Date().toISOString(); }
  pause(): void { this.model.status = 'paused'; this.model.updatedAt = new Date().toISOString(); }
  archive(): void { this.model.status = 'archived'; this.model.updatedAt = new Date().toISOString(); }

  getModel(): WorkflowModel { return { ...this.model, steps: [...this.model.steps] }; }

  static create(name: string, description?: string): Workflow {
    const now = new Date().toISOString();
    return new Workflow({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name, description,
      status: 'draft',
      steps: [],
      createdAt: now, updatedAt: now,
    });
  }
}
