export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export class ValidationService {
  validate(manifest?: unknown, dependencies?: unknown): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (manifest == null) {
      issues.push({ severity: 'error', message: 'Project manifest is missing.' });
    }

    if (dependencies == null) {
      issues.push({ severity: 'warning', message: 'Dependency information is unavailable.' });
    }

    return {
      valid: issues.every(i => i.severity !== 'error'),
      issues,
    };
  }
}
