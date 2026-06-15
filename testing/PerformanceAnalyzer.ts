export interface PerformanceSample {
  label: string;
  fps?: number;
  frameTimeMs?: number;
  drawCalls?: number;
  triangleCount?: number;
  recordedAt: string;
}

export interface PerformanceReport {
  samplesCount: number;
  averageFps?: number;
  minFps?: number;
  maxFps?: number;
  issues: string[];
}

export class PerformanceAnalyzer {
  private readonly samples: PerformanceSample[] = [];

  record(sample: Omit<PerformanceSample, 'recordedAt'>): void {
    this.samples.push({ ...sample, recordedAt: new Date().toISOString() });
  }

  analyze(targetFps = 60): PerformanceReport {
    const fpsSamples = this.samples.filter(s => s.fps !== undefined).map(s => s.fps!);
    const avgFps = fpsSamples.length > 0 ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : undefined;
    const issues: string[] = [];
    if (avgFps !== undefined && avgFps < targetFps) {
      issues.push(`Average FPS (${avgFps.toFixed(1)}) is below target (${targetFps})`);
    }
    return {
      samplesCount: this.samples.length,
      averageFps: avgFps,
      minFps: fpsSamples.length > 0 ? Math.min(...fpsSamples) : undefined,
      maxFps: fpsSamples.length > 0 ? Math.max(...fpsSamples) : undefined,
      issues,
    };
  }

  clear(): void {
    this.samples.length = 0;
  }
}
