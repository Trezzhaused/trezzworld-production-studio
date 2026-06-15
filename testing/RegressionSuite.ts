import { TestRunner, TestCase, TestResult } from './TestRunner';

export interface RegressionSuiteResult {
  suiteId: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  runAt: string;
  durationMs: number;
  results: TestResult[];
}

export class RegressionSuite {
  private readonly id: string;
  private readonly runner: TestRunner;

  constructor(id?: string) {
    this.id = id ?? `suite-${Date.now()}`;
    this.runner = new TestRunner();
  }

  add(test: TestCase): void {
    this.runner.register(test);
  }

  async execute(): Promise<RegressionSuiteResult> {
    const start = Date.now();
    const results = await this.runner.run();
    return {
      suiteId: this.id,
      totalTests: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      skipped: results.filter(r => r.status === 'skip').length,
      runAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      results,
    };
  }
}
