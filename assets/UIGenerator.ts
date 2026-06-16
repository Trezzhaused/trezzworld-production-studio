import { AssetItem } from '../orchestration/ProductionContracts';

export class UIGenerator {
  generate(projectId: string): AssetItem[] {
    return [
      {
        id: `${projectId}-ui-overlay`,
        kind: 'ui',
        name: 'Title Overlay',
        uri: `assets/${projectId}/ui/title-overlay.json`,
      },
    ];
  }
}
