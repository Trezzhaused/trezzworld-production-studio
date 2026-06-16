export interface AssetAnalysisRequest {
  assetId: string;
  assetPath: string;
  type: string;
}

export interface AssetAnalysisResult {
  assetId: string;
  valid: boolean;
  issues: string[];
  warnings: string[];
  analyzedAt: string;
}

export class AssetAnalyzer {
  analyze(request: AssetAnalysisRequest): AssetAnalysisResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    if (!request.assetPath) issues.push('Asset path is empty');
    if (!request.type) warnings.push('Asset type is unspecified');
    return {
      assetId: request.assetId,
      valid: issues.length === 0,
      issues,
      warnings,
      analyzedAt: new Date().toISOString(),
    };
  }

  analyzeBatch(requests: AssetAnalysisRequest[]): AssetAnalysisResult[] {
    return requests.map(r => this.analyze(r));
  }
}
