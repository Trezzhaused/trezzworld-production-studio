export class Upscaler {
  upscale(paths: string[]): string[] {
    return paths.map((path) => path.replace('.png', '.4k.png'));
  }
}
