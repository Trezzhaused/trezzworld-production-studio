import { CameraMove, Scene, Shot } from '../orchestration/ProductionContracts';

export class ShotComposer {
  compose(scenes: Scene[], cameraMoves: CameraMove[]): Shot[] {
    const cameraByScene = new Map(cameraMoves.map((move) => [move.sceneId, move]));

    return scenes.map((scene, index) => {
      const camera = cameraByScene.get(scene.id);
      return {
        id: `shot-${index + 1}`,
        sceneId: scene.id,
        direction: `Use ${camera?.movement ?? 'static'} at ${camera?.focalLengthMm ?? 35}mm`,
        durationSeconds: scene.durationSeconds,
      };
    });
  }
}
