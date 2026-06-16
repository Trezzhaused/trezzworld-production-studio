import { StoryboardShot } from './VideoDirector';

export class StoryboardEngine {
  build(shots: StoryboardShot[]): string[] {
    return shots.map((shot) => `frame:${shot.id}:${shot.description}`);
  }
}
