import { AssetItem } from '../orchestration/ProductionContracts';

export class CharacterGenerator {
  generate(projectId: string): AssetItem[] {
    return [
      {
        id: `${projectId}-character-hero`,
        kind: 'character',
        name: 'Hero',
        uri: `assets/${projectId}/characters/hero.glb`,
      },
      {
        id: `${projectId}-character-rival`,
        kind: 'character',
        name: 'Rival',
        uri: `assets/${projectId}/characters/rival.glb`,
      },
    ];
  }
}
