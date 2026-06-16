export interface CrashReport {
  id: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: string;
  resolved: boolean;
}

export class CrashReporter {
  private readonly reports: CrashReport[] = [];
  private enabled = true;

  enable(): void { this.enabled = true; }
  disable(): void { this.enabled = false; }
  isEnabled(): boolean { return this.enabled; }

  report(error: Error, context?: Record<string, unknown>): CrashReport {
    const rep: CrashReport = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    if (this.enabled) this.reports.push(rep);
    return { ...rep };
  }

  resolve(id: string): void {
    const r = this.reports.find(x => x.id === id);
    if (r) r.resolved = true;
  }

  list(resolved?: boolean): CrashReport[] {
    const all = this.reports.map(r => ({ ...r }));
    if (resolved === undefined) return all;
    return all.filter(r => r.resolved === resolved);
  }

  clear(): void { this.reports.length = 0; }
}
