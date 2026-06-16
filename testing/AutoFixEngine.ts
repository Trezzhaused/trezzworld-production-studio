import { TestResult } from './TestRunner';

export interface FixSuggestion {
  testId: string;
  description: string;
  autoApplicable: boolean;
  fix?: () => void | Promise<void>;
}

export interface AutoFixResult {
  applied: string[];
  failed: string[];
  skipped: string[];
}

export class AutoFixEngine {
  private readonly suggestions = new Map<string, FixSuggestion>();

  registerFix(suggestion: FixSuggestion): void {
    this.suggestions.set(suggestion.testId, suggestion);
  }

  suggest(failures: TestResult[]): FixSuggestion[] {
    return failures
      .filter(r => r.status === 'fail')
      .map(r => this.suggestions.get(r.testId))
      .filter((s): s is FixSuggestion => s !== undefined);
  }

  async applyAll(failures: TestResult[]): Promise<AutoFixResult> {
    const applicable = this.suggest(failures).filter(s => s.autoApplicable && s.fix);
    const applied: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];

    for (const s of this.suggest(failures)) {
      if (!s.autoApplicable || !s.fix) { skipped.push(s.testId); continue; }
      try {
        await s.fix();
        applied.push(s.testId);
      } catch {
        failed.push(s.testId);
      }
    }

    return { applied, failed, skipped };
  }
}
