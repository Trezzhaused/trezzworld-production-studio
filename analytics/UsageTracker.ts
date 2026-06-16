export interface UsageEvent {
  feature: string;
  count: number;
  firstUsed: string;
  lastUsed: string;
}

export class UsageTracker {
  private readonly usage = new Map<string, UsageEvent>();
  private enabled = true;

  enable(): void { this.enabled = true; }
  disable(): void { this.enabled = false; }
  isEnabled(): boolean { return this.enabled; }

  track(feature: string): void {
    if (!this.enabled) return;
    const existing = this.usage.get(feature);
    const now = new Date().toISOString();
    if (existing) {
      existing.count++;
      existing.lastUsed = now;
    } else {
      this.usage.set(feature, { feature, count: 1, firstUsed: now, lastUsed: now });
    }
  }

  get(feature: string): UsageEvent | undefined { return this.usage.get(feature); }

  list(): UsageEvent[] { return [...this.usage.values()]; }

  topFeatures(limit = 10): UsageEvent[] {
    return [...this.usage.values()].sort((a, b) => b.count - a.count).slice(0, limit);
  }

  reset(): void { this.usage.clear(); }
}
