export type TestStatus = 'pending' | 'pass' | 'fail' | 'skip';

export interface TestCase {
  id: string;
  name: string;
  run: () => void | Promise<void>;
}

export interface TestResult {
  testId: string;
  name: string;
  status: TestStatus;
  durationMs: number;
  error?: string;
}

export class TestRunner {
  private readonly tests: TestCase[] = [];

  register(test: TestCase): void {
    this.tests.push(test);
  }

  async run(filter?: string): Promise<TestResult[]> {
    const suite = filter
      ? this.tests.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
      : this.tests;
    const results: TestResult[] = [];
    for (const test of suite) {
      const start = Date.now();
      try {
        await test.run();
        results.push({ testId: test.id, name: test.name, status: 'pass', durationMs: Date.now() - start });
      } catch (err) {
        results.push({ testId: test.id, name: test.name, status: 'fail', durationMs: Date.now() - start, error: String(err) });
      }
    }
    return results;
  }

  list(): TestCase[] {
    return [...this.tests];
  }
}
