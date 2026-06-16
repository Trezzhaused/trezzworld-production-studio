import { StoryboardShot } from './VideoDirector';

export interface Scene {
  id: string;
  title: string;
  shotIds: string[];
}

export class SceneGenerator {
  generate(shots: StoryboardShot[]): Scene[] {
    const chunk = 3;
    const scenes: Scene[] = [];

    for (let index = 0; index < shots.length; index += chunk) {
      const group = shots.slice(index, index + chunk);
      scenes.push({
        id: `scene-${scenes.length + 1}`,
        title: `Scene ${scenes.length + 1}`,
        shotIds: group.map((shot) => shot.id),
      });
    }

    return scenes;
  }
}
