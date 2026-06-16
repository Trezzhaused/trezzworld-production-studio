import { Workflow } from './Workflow';

export type StepHandler = (
  config: Record<string, unknown> | undefined,
  context: Record<string, unknown>,
) => Promise<void>;

export interface WorkflowRunResult {
  workflowId: string;
  success: boolean;
  completedSteps: string[];
  failedStep?: string;
  error?: string;
  durationMs: number;
}

export class WorkflowEngine {
  private readonly workflows = new Map<string, Workflow>();
  private readonly handlers = new Map<string, StepHandler>();

  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.getId(), workflow);
  }

  registerHandler(type: string, handler: StepHandler): void {
    this.handlers.set(type, handler);
  }

  async run(workflowId: string, context: Record<string, unknown> = {}): Promise<WorkflowRunResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
    const model = workflow.getModel();
    if (model.status !== 'active') throw new Error(`Workflow is not active: ${workflowId}`);
    const start = Date.now();
    const completedSteps: string[] = [];
    for (const step of model.steps) {
      const handler = this.handlers.get(step.type);
      if (!handler) {
        return {
          workflowId, success: false, completedSteps, failedStep: step.id,
          error: `No handler for step type: ${step.type}`, durationMs: Date.now() - start,
        };
      }
      try {
        await handler(step.config, context);
        completedSteps.push(step.id);
      } catch (err) {
        return {
          workflowId, success: false, completedSteps, failedStep: step.id,
          error: (err as Error).message, durationMs: Date.now() - start,
        };
      }
    }
    return { workflowId, success: true, completedSteps, durationMs: Date.now() - start };
  }

  list(): string[] { return [...this.workflows.keys()]; }
}
