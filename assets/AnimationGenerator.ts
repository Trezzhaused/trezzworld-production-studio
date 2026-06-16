import { AssetItem } from '../orchestration/ProductionContracts';

export class AnimationGenerator {
  generate(projectId: string): AssetItem[] {
    return [
      {
        id: `${projectId}-animation-intro`,
        kind: 'animation',
        name: 'Intro Animation',
        uri: `assets/${projectId}/animations/intro.anim`,
      },
    ];
  }
}
