import { Metrics } from './Metrics';
import { UsageTracker } from './UsageTracker';
import { CrashReporter } from './CrashReporter';
import { PerformanceMonitor } from './PerformanceMonitor';

export { Metrics, UsageTracker, CrashReporter, PerformanceMonitor };

export class Telemetry {
  readonly metrics = new Metrics();
  readonly usage = new UsageTracker();
  readonly crashes = new CrashReporter();
  readonly performance = new PerformanceMonitor();
  private enabled = true;

  enable(): void {
    this.enabled = true;
    this.usage.enable();
    this.crashes.enable();
  }

  disable(): void {
    this.enabled = false;
    this.usage.disable();
    this.crashes.disable();
  }

  isEnabled(): boolean { return this.enabled; }

  trackEvent(name: string, data: Record<string, unknown> = {}): void {
    if (!this.enabled) return;
    this.usage.track(name);
    this.metrics.increment(`event.${name}`);
    void data;
  }

  trackCrash(error: Error, context?: Record<string, unknown>): void {
    this.crashes.report(error, context);
    this.metrics.increment('crash.total');
  }

  summary(): Record<string, unknown> {
    return {
      totalEvents: this.usage.list().reduce((s, e) => s + e.count, 0),
      topFeatures: this.usage.topFeatures(5),
      unresolvedCrashes: this.crashes.list(false).length,
    };
  }
}
