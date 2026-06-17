import { LUMIDirector } from "../orchestration/LUMIDirector";
import { AgentRuntime } from "../lumi/AgentRuntime";

export class Kernel {
  private director: LUMIDirector;
  private runtime: AgentRuntime;
  private running = false;

  constructor() {
    this.director = new LUMIDirector();
    this.runtime = new AgentRuntime();
  }

  async boot(): Promise<void> {
    this.running = true;
    await this.runtime.initialize();
    await this.director.start();
    console.log("[Kernel] TrezzWorld Production Studio online.");
  }

  async shutdown(): Promise<void> {
    this.running = false;
    await this.director.stop();
    console.log("[Kernel] Shutdown complete.");
  }

  isRunning(): boolean { return this.running; }
}
