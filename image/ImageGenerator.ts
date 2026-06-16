export class ImageGenerator {
  generate(projectId: string, prompts: string[]): string[] {
    return prompts.map((_, index) => `assets/${projectId}/images/frame-${index + 1}.png`);
  }
}
