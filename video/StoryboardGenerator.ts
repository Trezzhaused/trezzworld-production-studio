import { ScriptSegment, StoryboardFrame } from '../orchestration/ProductionContracts';

export class StoryboardGenerator {
  generate(script: ScriptSegment[]): StoryboardFrame[] {
    return script.map((segment) => ({
      id: `frame-${segment.id}`,
      sceneId: segment.id,
      description: `Visual board for: ${segment.text}`,
    }));
  }
}
