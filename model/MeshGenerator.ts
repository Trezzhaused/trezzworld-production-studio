export class MeshGenerator {
  generate(models: string[]): string[] {
    return models.map((model) => `${model}:mesh`);
  }
}
