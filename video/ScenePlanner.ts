import { Scene, ScriptSegment } from '../orchestration/ProductionContracts';

export class ScenePlanner {
  buildScenes(script: ScriptSegment[]): Scene[] {
    return script.map((segment, index) => ({
      id: `scene-${index + 1}`,
      title: `Scene ${index + 1}`,
      objective: segment.text,
      durationSeconds: segment.durationSeconds,
    }));
  }
}
