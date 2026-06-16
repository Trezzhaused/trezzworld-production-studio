import { AssetItem } from '../orchestration/ProductionContracts';

export class BackgroundGenerator {
  generate(projectId: string): AssetItem[] {
    return [
      {
        id: `${projectId}-background-main`,
        kind: 'background',
        name: 'Main Environment',
        uri: `assets/${projectId}/backgrounds/main.png`,
      },
    ];
  }
}
