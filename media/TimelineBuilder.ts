export interface TimelineSegment {
  id: string;
  startSeconds: number;
  durationSeconds: number;
  track: 'video' | 'audio' | 'subtitle' | 'effect';
}

export class TimelineBuilder {
  build(segments: TimelineSegment[]): TimelineSegment[] {
    return segments.sort((left, right) => left.startSeconds - right.startSeconds);
  }
}
