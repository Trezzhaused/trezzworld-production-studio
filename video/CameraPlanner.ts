import { CameraMove, Scene } from '../orchestration/ProductionContracts';

const movements: CameraMove['movement'][] = ['drone', 'dolly', 'pan', 'tilt', 'static'];

export class CameraPlanner {
  plan(scenes: Scene[]): CameraMove[] {
    return scenes.map((scene, index) => ({
      sceneId: scene.id,
      movement: movements[index % movements.length],
      focalLengthMm: 24 + (index % 4) * 12,
    }));
  }
}
