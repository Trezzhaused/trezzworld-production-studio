import { ScriptSegment, SubtitleCue } from '../orchestration/ProductionContracts';

export class SubtitleGenerator {
  generate(script: ScriptSegment[]): SubtitleCue[] {
    let cursor = 0;
    return script.map((segment) => {
      const startSeconds = cursor;
      cursor += segment.durationSeconds;
      return {
        startSeconds,
        endSeconds: cursor,
        text: segment.text,
      };
    });
  }
}
