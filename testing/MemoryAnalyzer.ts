export interface MemorySample {
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb?: number;
  recordedAt: string;
}

export interface MemoryReport {
  samplesCount: number;
  peakHeapMb: number;
  averageHeapMb: number;
  leakSuspected: boolean;
  issues: string[];
}

export class MemoryAnalyzer {
  private readonly samples: MemorySample[] = [];

  record(sample: Omit<MemorySample, 'recordedAt'>): void {
    this.samples.push({ ...sample, recordedAt: new Date().toISOString() });
  }

  analyze(leakThresholdMb = 50): MemoryReport {
    if (this.samples.length === 0) {
      return { samplesCount: 0, peakHeapMb: 0, averageHeapMb: 0, leakSuspected: false, issues: [] };
    }
    const heaps = this.samples.map(s => s.heapUsedMb);
    const avg = heaps.reduce((a, b) => a + b, 0) / heaps.length;
    const peak = Math.max(...heaps);
    const growth = heaps[heaps.length - 1] - heaps[0];
    const leakSuspected = growth > leakThresholdMb;
    const issues = leakSuspected ? [`Memory grew by ${growth.toFixed(1)} MB — possible leak`] : [];
    return { samplesCount: this.samples.length, peakHeapMb: peak, averageHeapMb: avg, leakSuspected, issues };
  }

  clear(): void {
    this.samples.length = 0;
  }
}
