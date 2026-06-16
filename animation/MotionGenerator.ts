export class MotionGenerator {
  generate(clips: string[]): string[] {
    return clips.map((clip) => `${clip}:motion-v1`);
  }
}
