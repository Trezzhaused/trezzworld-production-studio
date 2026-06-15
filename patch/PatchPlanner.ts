import { DiffRecord } from './DiffEngine';

export interface PatchPlan {
  operations: DiffRecord[];
  conflicts: string[];
}

export class PatchPlanner {
  plan(diff: DiffRecord[]): PatchPlan {
    const conflicts: string[] = [];
    const priority = { delete: 0, update: 1, insert: 2 } as const;
    const operations = [...diff].sort((a,b)=>priority[a.operation]-priority[b.operation]);
    const seen = new Set<string>();
    for (const op of operations) {
      const key = `${op.operation}:${op.targetId}`;
      if (seen.has(key)) conflicts.push(`Duplicate operation for ${key}`);
      seen.add(key);
    }
    return { operations, conflicts };
  }
}
