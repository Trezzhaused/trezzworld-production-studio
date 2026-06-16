import { Scene, Transition } from '../orchestration/ProductionContracts';

const transitionStyles: Transition['style'][] = ['fade', 'cut', 'wipe'];

export class TransitionEngine {
  build(scenes: Scene[]): Transition[] {
    const transitions: Transition[] = [];
    for (let index = 0; index < scenes.length - 1; index += 1) {
      transitions.push({
        fromSceneId: scenes[index].id,
        toSceneId: scenes[index + 1].id,
        style: transitionStyles[index % transitionStyles.length],
        durationSeconds: transitionStyles[index % transitionStyles.length] === 'cut' ? 0 : 1,
      });
    }
    return transitions;
  }
}
