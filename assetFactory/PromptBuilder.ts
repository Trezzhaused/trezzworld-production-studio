export interface PromptOptions {
  assetType: string;
  style?: string;
  quality?: string;
  negativePrompt?: string;
  robloxCompatible?: boolean;
}

export class PromptBuilder {
  build(basePrompt: string, options: PromptOptions): string {
    const parts: string[] = [basePrompt];
    if (options.assetType) parts.push(`Type: ${options.assetType}`);
    if (options.style) parts.push(`Style: ${options.style}`);
    if (options.quality) parts.push(`Quality: ${options.quality}`);
    if (options.robloxCompatible) parts.push('Roblox Compatible');
    if (options.negativePrompt) parts.push(`Avoid: ${options.negativePrompt}`);
    return parts.join(" | ");
  }
}
