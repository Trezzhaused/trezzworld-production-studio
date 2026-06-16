import { GenerationQueue } from '../assetFactory/GenerationQueue';

export interface DesignSpec {
  id: string;
  component: string;
  style: string;
  targetPlatform: 'desktop' | 'mobile' | 'roblox';
  createdAt: string;
}

export class AutoDesigner {
  constructor(private readonly queue: GenerationQueue) {}

  spec(component: string, style: string, targetPlatform: DesignSpec['targetPlatform'] = 'roblox'): DesignSpec {
    return {
      id: `design-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      component,
      style,
      targetPlatform,
      createdAt: new Date().toISOString(),
    };
  }

  async design(spec: DesignSpec): Promise<void> {
    this.queue.enqueue('ui', `Design ${spec.component} in ${spec.style} style for ${spec.targetPlatform}`, 7);
  }

  async designBatch(specs: DesignSpec[]): Promise<void> {
    for (const spec of specs) await this.design(spec);
  }
}
