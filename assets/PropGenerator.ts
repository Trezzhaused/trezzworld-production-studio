import { AssetItem } from '../orchestration/ProductionContracts';

export class PropGenerator {
  generate(projectId: string): AssetItem[] {
    return [
      {
        id: `${projectId}-prop-signature`,
        kind: 'prop',
        name: 'Signature Prop',
        uri: `assets/${projectId}/props/signature.glb`,
      },
    ];
  }
}
