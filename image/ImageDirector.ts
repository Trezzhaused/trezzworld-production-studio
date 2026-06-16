import { Generator } from '../capability/Generator';

export interface ImageRequest {
  prompts: string[];
}

export class ImageDirector implements Generator<ImageRequest, string[]> {
  readonly id = 'image-director';

  canHandle(input: ImageRequest): boolean {
    return input.prompts.length > 0;
  }

  async generate(input: ImageRequest): Promise<string[]> {
    return input.prompts.map((prompt, index) => `image-${index + 1}:${prompt}`);
  }
}
