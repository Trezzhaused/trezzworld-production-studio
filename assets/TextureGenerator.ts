import { AssetItem } from '../orchestration/ProductionContracts';

export class TextureGenerator {
  generate(projectId: string): AssetItem[] {
    return [
      {
        id: `${projectId}-texture-master`,
        kind: 'texture',
        name: 'Master Texture Pack',
        uri: `assets/${projectId}/textures/master.zip`,
      },
    ];
  }
}
