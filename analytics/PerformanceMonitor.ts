export interface PerformanceMeasurement {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export class PerformanceMonitor {
  private readonly active = new Map<string, PerformanceMeasurement>();
  private readonly completed: PerformanceMeasurement[] = [];

  start(name: string, metadata?: Record<string, unknown>): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.active.set(id, { id, name, startTime: Date.now(), metadata });
    return id;
  }

  end(id: string): PerformanceMeasurement {
    const m = this.active.get(id);
    if (!m) throw new Error(`Measurement not found: ${id}`);
    m.endTime = Date.now();
    m.durationMs = m.endTime - m.startTime;
    this.active.delete(id);
    this.completed.push({ ...m });
    return { ...m };
  }

  measure<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const id = this.start(name, metadata);
    try {
      const result = fn();
      this.end(id);
      return result;
    } catch (err) {
      this.end(id);
      throw err;
    }
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
    const id = this.start(name, metadata);
    try {
      const result = await fn();
      this.end(id);
      return result;
    } catch (err) {
      this.end(id);
      throw err;
    }
  }

  getCompleted(name?: string): PerformanceMeasurement[] {
    return name ? this.completed.filter(m => m.name === name) : [...this.completed];
  }

  averageDuration(name: string): number {
    const items = this.getCompleted(name);
    if (!items.length) return 0;
    return items.reduce((s, m) => s + (m.durationMs ?? 0), 0) / items.length;
  }

  clear(): void { this.completed.length = 0; }
}
