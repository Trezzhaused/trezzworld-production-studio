import { AssetItem } from '../orchestration/ProductionContracts';

export class IconGenerator {
  generate(projectId: string): AssetItem[] {
    return [
      {
        id: `${projectId}-icon-app`,
        kind: 'icon',
        name: 'Project Icon',
        uri: `assets/${projectId}/icons/app-icon.png`,
      },
    ];
  }
}
