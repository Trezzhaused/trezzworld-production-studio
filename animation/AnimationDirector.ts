import { Generator } from '../capability/Generator';

export interface AnimationRequest {
  clips: string[];
}

export class AnimationDirector implements Generator<AnimationRequest, string[]> {
  readonly id = 'animation-director';

  canHandle(input: AnimationRequest): boolean {
    return input.clips.length > 0;
  }

  async generate(input: AnimationRequest): Promise<string[]> {
    return input.clips.map((clip, index) => `anim-${index + 1}:${clip}`);
  }
}
