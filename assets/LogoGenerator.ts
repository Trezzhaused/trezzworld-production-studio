import { AssetItem } from '../orchestration/ProductionContracts';

export class LogoGenerator {
  generate(projectId: string): AssetItem[] {
    return [
      {
        id: `${projectId}-logo-main`,
        kind: 'logo',
        name: 'Project Logo',
        uri: `assets/${projectId}/logos/main.svg`,
      },
    ];
  }
}
