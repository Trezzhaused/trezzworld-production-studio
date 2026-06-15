export interface RegisteredAgent {
  id: string;
  name: string;
  available: boolean;
}

export interface Assignment {
  taskId: string;
  agentId: string;
  assignedAt: string;
}

export class AgentCoordinator {
  private agents: RegisteredAgent[] = [];
  private assignments: Assignment[] = [];

  register(id: string, name: string): RegisteredAgent {
    const agent = { id, name, available: true };
    this.agents.push(agent);
    return { ...agent };
  }

  assign(taskId: string, agentId: string): Assignment {
    const assignment: Assignment = {
      taskId,
      agentId,
      assignedAt: new Date().toISOString(),
    };
    this.assignments.push(assignment);
    return { ...assignment };
  }

  listAgents(): RegisteredAgent[] {
    return [...this.agents];
  }

  listAssignments(): Assignment[] {
    return [...this.assignments];
  }
}
