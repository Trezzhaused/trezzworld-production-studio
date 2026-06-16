export class MaterialGenerator {
  generate(meshes: string[]): string[] {
    return meshes.map((mesh) => `${mesh}:material`);
  }
}
