import { Scene } from './SceneGenerator';

export interface CameraPlan {
  sceneId: string;
  movement: 'pan' | 'tilt' | 'dolly' | 'drone' | 'static';
}

const moves: CameraPlan['movement'][] = ['drone', 'dolly', 'pan', 'tilt', 'static'];

export class CameraEngine {
  plan(scenes: Scene[]): CameraPlan[] {
    return scenes.map((scene, index) => ({
      sceneId: scene.id,
      movement: moves[index % moves.length],
    }));
  }
}
