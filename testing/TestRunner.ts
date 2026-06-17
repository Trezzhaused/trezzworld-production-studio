export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<boolean> }> = [];

  register(name: string, fn: () => Promise<boolean>): void {
    this.tests.push({ name, fn });
  }

  async runAll(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    for (const test of this.tests) {
      const start = Date.now();
      try {
        const passed = await test.fn();
        results.push({ name: test.name, passed, duration: Date.now() - start });
      } catch (e: unknown) {
        results.push({ name: test.name, passed: false, error: String(e), duration: Date.now() - start });
      }
    }
    return results;
  }

  summary(results: TestResult[]): string {
    const passed = results.filter(r => r.passed).length;
    return `${passed}/${results.length} tests passed`;
  }
}
