export class RigGenerator {
  generate(materials: string[]): string[] {
    return materials.map((material) => `${material}:rig`);
  }
}
