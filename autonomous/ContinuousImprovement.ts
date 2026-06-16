import { AutoManager } from './AutoManager';
import { AutoOptimizer } from './AutoOptimizer';
import { AutoTester } from './AutoTester';

export interface ImprovementCycle {
  id: string;
  iteration: number;
  optimizationRecommendations: string[];
  testsPassed: number;
  testsFailed: number;
  startedAt: string;
  completedAt?: string;
}

export class ContinuousImprovement {
  private iteration = 0;
  private readonly cycles: ImprovementCycle[] = [];
  private running = false;

  constructor(
    private readonly manager: AutoManager,
    private readonly optimizer: AutoOptimizer,
    private readonly tester: AutoTester,
  ) {}

  async runCycle(): Promise<ImprovementCycle> {
    const cycle: ImprovementCycle = {
      id: `cycle-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      iteration: ++this.iteration,
      optimizationRecommendations: [],
      testsPassed: 0,
      testsFailed: 0,
      startedAt: new Date().toISOString(),
    };

    const report = this.optimizer.optimize();
    cycle.optimizationRecommendations = report.recommendations;

    const testReport = await this.tester.run();
    cycle.testsPassed = testReport.suiteResult.passed;
    cycle.testsFailed = testReport.suiteResult.failed;
    cycle.completedAt = new Date().toISOString();

    this.cycles.push(cycle);
    return { ...cycle };
  }

  start(): void { this.running = true; }
  stop(): void { this.running = false; }
  isRunning(): boolean { return this.running; }

  getCycles(): ImprovementCycle[] {
    return [...this.cycles];
  }

  getIteration(): number {
    return this.iteration;
  }
}
