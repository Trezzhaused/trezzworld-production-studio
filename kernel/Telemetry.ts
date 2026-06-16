export interface TelemetryEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface TelemetryMetric {
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  tags?: Record<string, string>;
}

export class Telemetry {
  private readonly events: TelemetryEvent[] = [];
  private readonly metrics: TelemetryMetric[] = [];
  private enabled = true;

  enable(): void { this.enabled = true; }
  disable(): void { this.enabled = false; }
  isEnabled(): boolean { return this.enabled; }

  track(type: string, data: Record<string, unknown> = {}): void {
    if (!this.enabled) return;
    this.events.push({ type, data, timestamp: new Date().toISOString() });
  }

  measure(name: string, value: number, unit?: string, tags?: Record<string, string>): void {
    if (!this.enabled) return;
    this.metrics.push({ name, value, unit, tags, timestamp: new Date().toISOString() });
  }

  trackCrash(error: Error, context?: Record<string, unknown>): void {
    this.track('crash', { message: error.message, stack: error.stack, ...context });
  }

  getEvents(type?: string): TelemetryEvent[] {
    return type ? this.events.filter(e => e.type === type) : [...this.events];
  }

  getMetrics(name?: string): TelemetryMetric[] {
    return name ? this.metrics.filter(m => m.name === name) : [...this.metrics];
  }

  flush(): { events: TelemetryEvent[]; metrics: TelemetryMetric[] } {
    const snapshot = { events: [...this.events], metrics: [...this.metrics] };
    this.events.length = 0;
    this.metrics.length = 0;
    return snapshot;
  }
}
