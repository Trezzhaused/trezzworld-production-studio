import { TestRunner, TestCase, TestResult } from '../testing/TestRunner';
import { RegressionSuite, RegressionSuiteResult } from '../testing/RegressionSuite';

export interface AutoTestReport {
  suiteResult: RegressionSuiteResult;
  autoFixed: number;
  remainingFailures: number;
  testedAt: string;
}

export class AutoTester {
  private readonly suite: RegressionSuite;

  constructor(suiteId?: string) {
    this.suite = new RegressionSuite(suiteId ?? 'auto-test-suite');
  }

  addTest(test: TestCase): void {
    this.suite.add(test);
  }

  async run(): Promise<AutoTestReport> {
    const suiteResult = await this.suite.execute();
    return {
      suiteResult,
      autoFixed: 0,
      remainingFailures: suiteResult.failed,
      testedAt: new Date().toISOString(),
    };
  }
}
