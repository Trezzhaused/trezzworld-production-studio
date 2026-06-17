import { MetaDevelopmentEngine } from "../lumi/MetaDevelopmentEngine";
import { LumiOrchestrator } from "../orchestration/LumiOrchestrator";

export class ContinuousImprovement {
  private engine = new MetaDevelopmentEngine();
  private orchestrator = new LumiOrchestrator();
  private running = false;
  private intervalMs: number;

  constructor(intervalMs = 3600000) { // default: 1 hour
    this.intervalMs = intervalMs;
  }

  async start(): Promise<void> {
    this.running = true;
    console.log("[ContinuousImprovement] Autonomous improvement loop started.");
    while (this.running) {
      await this.cycle();
      await new Promise(r => setTimeout(r, this.intervalMs));
    }
  }

  stop(): void { this.running = false; }

  async cycle(): Promise<void> {
    console.log("[ContinuousImprovement] Running improvement cycle...");
    const result = await this.engine.runCycle();
    if (result.actions.length > 0) {
      for (const action of result.actions) {
        await this.orchestrator.execute(action);
      }
    }
    console.log(`[ContinuousImprovement] Cycle complete. ${result.actions.length} actions taken.`);
  }

  isRunning(): boolean { return this.running; }
}
