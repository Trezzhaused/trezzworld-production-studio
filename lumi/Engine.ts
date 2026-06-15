import { Planner } from "./Planner";
import { AgentCoordinator } from "./AgentCoordinator";
import { TaskGraph } from "./TaskGraph";
import { CodeGenerator } from "./CodeGenerator";
import { Validator } from "./Validator";
import { PatchExecutor } from "./PatchExecutor";
import { ReviewEngine } from "./ReviewEngine";
import { ExecutionContext } from "./ExecutionContext";

export interface EngineRequest {
  goal: string;
  context?: Record<string, unknown>;
}

export interface EngineResult {
  success: boolean;
  goal: string;
  completedAt: string;
}

export class Engine {
  constructor(
    private readonly planner = new Planner(),
    private readonly coordinator = new AgentCoordinator(),
    private readonly taskGraph = new TaskGraph(),
    private readonly generator = new CodeGenerator(),
    private readonly validator = new Validator(),
    private readonly patchExecutor = new PatchExecutor(),
    private readonly reviewer = new ReviewEngine()
  ) {}

  async execute(request: EngineRequest): Promise<EngineResult> {
    const executionContext = new ExecutionContext();
    const plan: any = (this.planner as any).plan?.(request.goal, executionContext) ?? request.goal;
    const tasks: any = (this.taskGraph as any).build?.(plan) ?? plan;
    (this.coordinator as any).coordinate?.(tasks);
    const generated: any = await ((this.generator as any).generate?.(tasks) ?? tasks);
    await ((this.validator as any).validate?.(generated) ?? Promise.resolve());
    await ((this.patchExecutor as any).execute?.(generated) ?? Promise.resolve());
    await ((this.reviewer as any).review?.(generated) ?? Promise.resolve());
    return { success: true, goal: request.goal, completedAt: new Date().toISOString() };
  }
}
