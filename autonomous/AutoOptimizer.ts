import { AssetMetrics } from '../assetFactory/AssetMetrics';
import { ResourceManager } from '../runtime/ResourceManager';

export interface OptimizationReport {
  id: string;
  recommendations: string[];
  appliedAt: string;
}

export class AutoOptimizer {
  constructor(
    private readonly metrics: AssetMetrics,
    private readonly resources: ResourceManager,
  ) {}

  analyze(): string[] {
    const recommendations: string[] = [];
    const usage = this.resources.getUsage();
    const quota = this.resources.getQuota();

    if (usage.memoryMb > quota.maxMemoryMb * 0.8) {
      recommendations.push('Memory usage is above 80% — consider evicting asset cache');
    }
    if (usage.cpuPercent > quota.maxCpuPercent * 0.9) {
      recommendations.push('CPU usage is above 90% — reduce concurrent job concurrency');
    }

    const summary = this.metrics.summary();
    for (const metric of summary) {
      if (metric.total > 0 && metric.failed / metric.total > 0.1) {
        recommendations.push(`High failure rate for "${metric.category}" (${(metric.failed / metric.total * 100).toFixed(0)}%) — investigate generator`);
      }
    }

    return recommendations;
  }

  optimize(): OptimizationReport {
    return {
      id: `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      recommendations: this.analyze(),
      appliedAt: new Date().toISOString(),
    };
  }
}
