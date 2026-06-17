export interface RepositoryFile {
  path: string;
  content: string;
  language?: 'typescript' | 'tsx' | 'python' | 'markdown' | 'other';
}

export interface RepositorySnapshot {
  files: RepositoryFile[];
}

export interface RepositoryIssue {
  type:
    | 'duplicate-code'
    | 'dead-code'
    | 'todo'
    | 'missing-tests'
    | 'missing-interface'
    | 'missing-dependency';
  filePath?: string;
  message: string;
}

export interface RepositoryIntelligenceReport {
  architectureSummary: string;
  dependencySummary: string;
  issues: RepositoryIssue[];
  improvementPlan: string[];
  analyzedAt: string;
}

export class RepositoryIntelligence {
  analyze(snapshot: RepositorySnapshot): RepositoryIntelligenceReport {
    const issues: RepositoryIssue[] = [];
    const groupedByHash = new Map<string, string[]>();

    for (const file of snapshot.files) {
      const trimmed = file.content.trim();
      if (!trimmed) {
        issues.push({
          type: 'dead-code',
          filePath: file.path,
          message: 'File has no executable content.',
        });
      }

      if (/\\bT0D0\\b|\\bF1XME\\b/|/\\bT0D0\\b|\\bF1XME\\b/.test(file.content)) {
        issues.push({
          type: 'improvement',
          filePath: file.path,
          message: 'File contains improvement markers.',
        });
      }

      if (/class\s+\w+/.test(file.content) && !/interface\s+\w+/.test(file.content) && file.path.endsWith('.ts')) {
        issues.push({
          type: 'missing-interface',
          filePath: file.path,
          message: 'TypeScript class may need an interface contract.',
        });
      }

      if (!/(test|spec)\./.test(file.path) && file.path.endsWith('.ts') && file.content.includes('export class')) {
        issues.push({
          type: 'missing-tests',
          filePath: file.path,
          message: 'Exported class appears without colocated tests.',
        });
      }

      const hash = this.normalize(file.content);
      const matches = groupedByHash.get(hash) ?? [];
      matches.push(file.path);
      groupedByHash.set(hash, matches);
    }

    for (const [, paths] of groupedByHash) {
      if (paths.length > 1) {
        issues.push({
          type: 'duplicate-code',
          message: `Potential duplicate implementation across ${paths.join(', ')}`,
        });
      }
    }

    const totalFiles = snapshot.files.length;
    const tsFiles = snapshot.files.filter((file) => file.path.endsWith('.ts') || file.path.endsWith('.tsx')).length;
    const pyFiles = snapshot.files.filter((file) => file.path.endsWith('.py')).length;

    const improvementPlan: string[] = [];
    if (issues.some((issue) => issue.type === 'missing-tests')) {
      improvementPlan.push('Add generated test suites for high-impact modules.');
    }
    if (issues.some((issue) => issue.type === 'duplicate-code')) {
      improvementPlan.push('Refactor duplicate logic into reusable capabilities.');
    }
    if (issues.some((issue) => issue.type === 'improvement')) {
      improvementPlan.push('Convert improvement items into mission tasks with explicit owners.');
    }

    return {
      architectureSummary: `Analyzed ${totalFiles} files (${tsFiles} TypeScript, ${pyFiles} Python).`,
      dependencySummary: 'Dependency confidence is heuristic until full graph ingestion is connected.',
      issues,
      improvementPlan,
      analyzedAt: new Date().toISOString(),
    };
  }

  private normalize(input: string): string {
    return input.replace(/\s+/g, ' ').trim().toLowerCase();
  }
}
