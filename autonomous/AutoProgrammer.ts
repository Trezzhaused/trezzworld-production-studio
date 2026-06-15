import { GenerationQueue } from '../assetFactory/GenerationQueue';

export interface CodeSpec {
  id: string;
  feature: string;
  language: 'typescript' | 'luau' | 'javascript';
  outputPath: string;
  createdAt: string;
}

export class AutoProgrammer {
  constructor(private readonly queue: GenerationQueue) {}

  spec(feature: string, language: CodeSpec['language'], outputPath: string): CodeSpec {
    return {
      id: `code-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      feature,
      language,
      outputPath,
      createdAt: new Date().toISOString(),
    };
  }

  async generate(spec: CodeSpec): Promise<void> {
    this.queue.enqueue('model', `Generate ${spec.language} code for: ${spec.feature}`, 8);
  }

  async generateBatch(specs: CodeSpec[]): Promise<void> {
    for (const spec of specs) await this.generate(spec);
  }
}
