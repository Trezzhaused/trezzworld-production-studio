import { PatchPlan } from './PatchPlanner';
import { DiffRecord } from './DiffEngine';

export interface PatchResult {
  applied: DiffRecord[];
  failed: DiffRecord[];
}

export class PatchApplier {
  apply(plan: PatchPlan): PatchResult {
    if (plan.conflicts.length) {
      throw new Error(`Patch plan has conflicts: ${plan.conflicts.join(', ')}`);
    }
    const applied: DiffRecord[] = [];
    const failed: DiffRecord[] = [];
    for (const op of plan.operations) {
      try {
        // Execution hook: future implementations will modify AST/project state.
        applied.push(op);
      } catch {
        failed.push(op);
        break;
      }
    }
    return { applied, failed };
  }
}
