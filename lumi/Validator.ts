export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  rule: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  validatedAt: string;
}

export class Validator {
  validate(source: string): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (!source.trim()) {
      issues.push({
        severity: 'error',
        message: 'Source is empty.',
        rule: 'non-empty-source',
      });
    }

    if (source.length > 100000) {
      issues.push({
        severity: 'warning',
        message: 'Source is unusually large.',
        rule: 'source-size',
      });
    }

    return {
      passed: !issues.some(i => i.severity === 'error'),
      issues,
      validatedAt: new Date().toISOString(),
    };
  }
}
