export interface Mission {
  id: string;
  prompt: string;
  stages: string[];
  status: "pending" | "executing" | "complete" | "failed";
  createdAt: number;
}

export class MissionPlanner {
  private missions: Map<string, Mission> = new Map();

  plan(prompt: string): Mission {
    const mission: Mission = {
      id: `mission-${Date.now()}`,
      prompt,
      stages: [
        "Parse objective",
        "Decompose into tasks",
        "Assign agents",
        "Execute pipeline",
        "Validate output",
        "Deliver result",
      ],
      status: "pending",
      createdAt: Date.now(),
    };
    this.missions.set(mission.id, mission);
    return mission;
  }

  getAll(): Mission[] {
    return Array.from(this.missions.values());
  }

  get(id: string): Mission | undefined {
    return this.missions.get(id);
  }

  updateStatus(id: string, status: Mission["status"]): void {
    const m = this.missions.get(id);
    if (m) m.status = status;
  }
}
