export type GeneratorType =
  | 'image' | 'model' | 'audio' | 'animation' | 'ui'
  | 'scene' | 'terrain' | 'lighting' | 'npc' | 'quest' | 'dialogue';

export interface GeneratorEntry {
  type: GeneratorType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
  version: string;
}

export class GeneratorRegistry {
  private readonly generators = new Map<GeneratorType, GeneratorEntry>();

  register(entry: GeneratorEntry): void {
    if (this.generators.has(entry.type)) {
      throw new Error(`Generator already registered: ${entry.type}`);
    }
    this.generators.set(entry.type, entry);
  }

  resolve<T = unknown>(type: GeneratorType): T {
    const entry = this.generators.get(type);
    if (!entry) throw new Error(`Generator not found: ${type}`);
    return entry.instance as T;
  }

  has(type: GeneratorType): boolean {
    return this.generators.has(type);
  }

  list(): GeneratorEntry[] {
    return [...this.generators.values()];
  }

  unregister(type: GeneratorType): boolean {
    return this.generators.delete(type);
  }
}
