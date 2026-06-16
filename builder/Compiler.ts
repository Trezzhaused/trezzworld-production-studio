export interface CompileInput {
  id: string;
  source: string;
  type: 'lua' | 'luau' | 'ts' | 'other';
  path?: string;
}

export interface CompileResult {
  id: string;
  success: boolean;
  output?: string;
  errors?: string[];
  warnings?: string[];
  durationMs: number;
}

export class Compiler {
  private readonly transformers = new Map<string, (src: string) => string>();

  registerTransformer(type: string, fn: (src: string) => string): void {
    this.transformers.set(type, fn);
  }

  async compile(input: CompileInput): Promise<CompileResult> {
    const start = Date.now();
    try {
      const transform = this.transformers.get(input.type);
      const output = transform ? transform(input.source) : input.source;
      return { id: input.id, success: true, output, durationMs: Date.now() - start };
    } catch (err) {
      return {
        id: input.id,
        success: false,
        errors: [(err as Error).message],
        durationMs: Date.now() - start,
      };
    }
  }

  async compileAll(inputs: CompileInput[]): Promise<CompileResult[]> {
    return Promise.all(inputs.map(i => this.compile(i)));
  }
}
