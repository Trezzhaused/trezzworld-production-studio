import { AutoArchitect, ArchitectPlan } from './AutoArchitect';
import { AutoProgrammer } from './AutoProgrammer';
import { AutoDesigner } from './AutoDesigner';
import { AutoArtist } from './AutoArtist';
import { AutoTester } from './AutoTester';
import { AutoOptimizer } from './AutoOptimizer';
import { AutoPublisher } from './AutoPublisher';

export type AutoManagerState = 'idle' | 'planning' | 'executing' | 'testing' | 'publishing' | 'done';

export class AutoManager {
  private state: AutoManagerState = 'idle';
  private activePlan?: ArchitectPlan;

  constructor(
    readonly architect: AutoArchitect,
    readonly programmer: AutoProgrammer,
    readonly designer: AutoDesigner,
    readonly artist: AutoArtist,
    readonly tester: AutoTester,
    readonly optimizer: AutoOptimizer,
    readonly publisher: AutoPublisher,
  ) {}

  async plan(description: string, modules: string[]): Promise<ArchitectPlan> {
    this.state = 'planning';
    this.activePlan = this.architect.plan(description, modules);
    return this.activePlan;
  }

  async execute(): Promise<void> {
    if (!this.activePlan) throw new Error('No active plan — call plan() first');
    this.state = 'executing';
    await this.architect.implement(this.activePlan);
  }

  async test(): Promise<void> {
    this.state = 'testing';
    await this.tester.run();
  }

  complete(): void {
    this.state = 'done';
    this.activePlan = undefined;
  }

  getState(): AutoManagerState {
    return this.state;
  }
}
