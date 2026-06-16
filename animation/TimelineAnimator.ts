export class TimelineAnimator {
  build(motions: string[]): string[] {
    return motions.map((motion, index) => `timeline-${index + 1}:${motion}`);
  }
}
