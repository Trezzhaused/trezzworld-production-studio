export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface AssetValidationIssue {
  severity: ValidationSeverity;
  rule: string;
  message: string;
}

export interface AssetValidationReport {
  passed: boolean;
  issues: AssetValidationIssue[];
  validatedAt: string;
}

export class AssetValidator {
  validate(metadata:{robloxCompatible:boolean;format?:string;resolution?:string;tags?:string[]}): AssetValidationReport {
    const issues: AssetValidationIssue[] = [];
    if (!metadata.robloxCompatible) {
      issues.push({severity:'error',rule:'roblox-compatibility',message:'Asset is not Roblox compatible.'});
    }
    if (!metadata.format) {
      issues.push({severity:'warning',rule:'format',message:'Asset format not specified.'});
    }
    if (!metadata.resolution) {
      issues.push({severity:'warning',rule:'resolution',message:'Asset resolution not specified.'});
    }
    return {
      passed: !issues.some(i=>i.severity==='error'),
      issues,
      validatedAt:new Date().toISOString(),
    };
  }
}
