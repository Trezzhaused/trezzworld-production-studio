export interface MetricPoint {
  value: number;
  timestamp: string;
  tags?: Record<string, string>;
}

export class Metrics {
  private readonly series = new Map<string, MetricPoint[]>();

  record(name: string, value: number, tags?: Record<string, string>): void {
    const points = this.series.get(name) ?? [];
    points.push({ value, tags, timestamp: new Date().toISOString() });
    this.series.set(name, points);
  }

  increment(name: string, amount = 1, tags?: Record<string, string>): void {
    const last = this.last(name);
    this.record(name, (last?.value ?? 0) + amount, tags);
  }

  get(name: string): MetricPoint[] { return [...(this.series.get(name) ?? [])]; }

  last(name: string): MetricPoint | undefined {
    const pts = this.series.get(name);
    return pts?.[pts.length - 1];
  }

  average(name: string): number {
    const pts = this.series.get(name);
    if (!pts?.length) return 0;
    return pts.reduce((s, p) => s + p.value, 0) / pts.length;
  }

  clear(name?: string): void {
    if (name) this.series.delete(name);
    else this.series.clear();
  }

  names(): string[] { return [...this.series.keys()]; }
}
