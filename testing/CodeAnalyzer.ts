export interface CodeAnalysisRequest {
  filePath: string;
  content: string;
  language?: 'typescript' | 'luau' | 'javascript';
}

export interface CodeAnalysisResult {
  filePath: string;
  valid: boolean;
  issues: string[];
  warnings: string[];
  linesOfCode: number;
  analyzedAt: string;
}

export class CodeAnalyzer {
  analyze(request: CodeAnalysisRequest): CodeAnalysisResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const lines = request.content.split('\n');
    if (lines.length > 1000) warnings.push(`File is large (${lines.length} lines) — consider splitting`);
    if (request.content.includes('improvement')) warnings.push('File contains improvement comments');
    if (request.content.includes('console.log')) warnings.push('File contains console.log statements');
    return {
      filePath: request.filePath,
      valid: issues.length === 0,
      issues,
      warnings,
      linesOfCode: lines.length,
      analyzedAt: new Date().toISOString(),
    };
  }
}
