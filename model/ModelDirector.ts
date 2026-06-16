import { Generator } from '../capability/Generator';

export interface ModelRequest {
  prompts: string[];
}

export class ModelDirector implements Generator<ModelRequest, string[]> {
  readonly id = 'model-director';

  canHandle(input: ModelRequest): boolean {
    return input.prompts.length > 0;
  }

  async generate(input: ModelRequest): Promise<string[]> {
    return input.prompts.map((prompt, index) => `model-${index + 1}:${prompt}`);
  }
}
