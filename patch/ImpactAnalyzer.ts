import { DependencyGraph } from "../digitalTwin/DependencyGraph";

export interface ImpactReport {
  targetId: string;
  affected: string[];
  riskScore: number;
}

export class ImpactAnalyzer {
  constructor(private readonly dependencies: DependencyGraph) {}

  analyze(targetId: string): ImpactReport {
    const visited = new Set<string>();
    const affected: string[] = [];

    const visit = (id: string) => {
      for (const dependent of this.dependencies.getDependents(id)) {
        if (visited.has(dependent)) continue;
        visited.add(dependent);
        affected.push(dependent);
        visit(dependent);
      }
    };

    visit(targetId);

    return {
      targetId,
      affected,
      riskScore: affected.length,
    };
  }
}
