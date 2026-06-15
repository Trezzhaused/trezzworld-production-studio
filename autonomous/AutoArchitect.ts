import { GenerationQueue } from '../assetFactory/GenerationQueue';
import { AssetGraph } from '../assetFactory/AssetGraph';

export interface ArchitectPlan {
  id: string;
  description: string;
  modules: string[];
  dependencies: Record<string, string[]>;
  createdAt: string;
}

export class AutoArchitect {
  constructor(
    private readonly queue: GenerationQueue,
    private readonly graph: AssetGraph,
  ) {}

  plan(description: string, modules: string[]): ArchitectPlan {
    return {
      id: `arch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description,
      modules,
      dependencies: Object.fromEntries(modules.map(m => [m, []])),
      createdAt: new Date().toISOString(),
    };
  }

  async implement(plan: ArchitectPlan): Promise<void> {
    for (const module of plan.modules) {
      this.queue.enqueue('model', `Generate module: ${module}`, 5);
    }
  }
}
