export interface GenerationMetric {
  category: string;
  total: number;
  succeeded: number;
  failed: number;
  totalDurationMs: number;
  averageDurationMs: number;
}

export class AssetMetrics {
  private readonly counters = new Map<string, { total: number; succeeded: number; failed: number; totalMs: number }>();

  record(category: string, succeeded: boolean, durationMs: number): void {
    const c = this.counters.get(category) ?? { total: 0, succeeded: 0, failed: 0, totalMs: 0 };
    c.total++;
    if (succeeded) c.succeeded++; else c.failed++;
    c.totalMs += durationMs;
    this.counters.set(category, c);
  }

  get(category: string): GenerationMetric | undefined {
    const c = this.counters.get(category);
    if (!c) return undefined;
    return {
      category,
      total: c.total,
      succeeded: c.succeeded,
      failed: c.failed,
      totalDurationMs: c.totalMs,
      averageDurationMs: c.total > 0 ? c.totalMs / c.total : 0,
    };
  }

  summary(): GenerationMetric[] {
    return [...this.counters.keys()].map(k => this.get(k)!);
  }

  reset(category?: string): void {
    if (category) this.counters.delete(category);
    else this.counters.clear();
  }
}
