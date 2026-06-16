export class ImageRefiner {
  refine(paths: string[]): string[] {
    return paths.map((path) => path.replace('.png', '.refined.png'));
  }
}
