import { Scene, SFXTrack } from '../orchestration/ProductionContracts';

export class SFXLibrary {
  select(scenePlan: Scene[]): SFXTrack {
    const effects = scenePlan.map((scene, index) => `sfx-${index + 1}-${scene.title.toLowerCase().replace(/\s+/g, '-')}`);
    const durationSeconds = scenePlan.reduce((total, scene) => total + scene.durationSeconds, 0);

    return {
      id: `sfx-${Date.now()}`,
      effects,
      durationSeconds,
    };
  }
}
