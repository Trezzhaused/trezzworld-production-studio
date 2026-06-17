import { MissionPlanner } from "./MissionPlanner";
import { LUMIDirector } from "./LUMIDirector";
import { ToolRouter } from "../capability/ToolRouter";

export class LumiOrchestrator {
  private planner = new MissionPlanner();
  private director = new LUMIDirector();
  private router = new ToolRouter();

  async execute(prompt: string): Promise<{ missionId: string; result: unknown }> {
    const mission = this.planner.plan(prompt);
    this.planner.updateStatus(mission.id, "executing");

    const capabilities = this.router.listCapabilities();
    console.log(`[LumiOrchestrator] Mission ${mission.id} — ${capabilities.length} capabilities available`);

    const dispatch = await this.director.dispatchMission(prompt);
    this.planner.updateStatus(mission.id, "complete");

    return { missionId: mission.id, result: dispatch };
  }

  getMissions() { return this.planner.getAll(); }
}
