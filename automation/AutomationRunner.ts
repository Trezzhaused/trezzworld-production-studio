import { WorkflowEngine } from './WorkflowEngine';
import { JobQueue } from './JobQueue';
import { CronManager } from './CronManager';
import { Trigger } from './Trigger';

export class AutomationRunner {
  readonly engine: WorkflowEngine;
  readonly queue: JobQueue;
  readonly cron: CronManager;
  private readonly triggers = new Map<string, Trigger>();

  constructor(engine: WorkflowEngine, concurrency = 2) {
    this.engine = engine;
    this.queue = new JobQueue(concurrency);
    this.cron = new CronManager();
  }

  registerTrigger(trigger: Trigger): void {
    this.triggers.set(trigger.getId(), trigger);
  }

  async fireTrigger(triggerId: string): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) throw new Error(`Trigger not found: ${triggerId}`);
    trigger.fire();
    const workflowId = trigger.getWorkflowId();
    this.queue.enqueue(`trigger:${triggerId}`, async () => {
      await this.engine.run(workflowId);
    });
    await this.queue.drain();
  }

  async runWorkflow(workflowId: string, context?: Record<string, unknown>): Promise<void> {
    await this.engine.run(workflowId, context);
  }

  async drainQueue(): Promise<void> {
    await this.queue.drain();
  }

  stopCron(): void { this.cron.stopAll(); }

  listTriggers(): ReturnType<Trigger['getModel']>[] {
    return [...this.triggers.values()].map(t => t.getModel());
  }
}
