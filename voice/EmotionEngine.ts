export class EmotionEngine {
  tag(lines: string[]): string[] {
    return lines.map((line) => `[intense] ${line}`);
  }
}
