export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  dependsOn: string[];
  completed: boolean;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  createdAt: string;
  steps: PlanStep[];
}

export class Planner {
  createPlan(goal: string): ExecutionPlan {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      goal,
      createdAt: new Date().toISOString(),
      steps: [],
    };
  }

  addStep(plan: ExecutionPlan, title: string, description?: string, dependsOn: string[] = []): PlanStep {
    const step: PlanStep = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      description,
      dependsOn,
      completed: false,
    };
    plan.steps.push(step);
    return { ...step };
  }

  completeStep(plan: ExecutionPlan, stepId: string): void {
    const step = plan.steps.find(s => s.id === stepId);
    if (!step) throw new Error(`Plan step not found: ${stepId}`);
    step.completed = true;
  }

  isComplete(plan: ExecutionPlan): boolean {
    return plan.steps.every(s => s.completed);
  }
}
