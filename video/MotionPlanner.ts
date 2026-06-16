import { CameraPlan } from './CameraEngine';

export class MotionPlanner {
  plan(camera: CameraPlan[]): string[] {
    return camera.map((item) => `${item.sceneId}:${item.movement}`);
  }
}
