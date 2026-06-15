import { GenerationQueue } from '../assetFactory/GenerationQueue';
import { AssetCategory } from '../assetFactory/AssetRequest';

export interface ArtRequest {
  id: string;
  category: AssetCategory;
  prompt: string;
  style: string;
  createdAt: string;
}

export class AutoArtist {
  constructor(private readonly queue: GenerationQueue) {}

  request(category: AssetCategory, prompt: string, style = 'default'): ArtRequest {
    return {
      id: `art-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      category,
      prompt,
      style,
      createdAt: new Date().toISOString(),
    };
  }

  async create(req: ArtRequest): Promise<void> {
    this.queue.enqueue(req.category, `${req.prompt} [style:${req.style}]`, 6);
  }

  async createBatch(requests: ArtRequest[]): Promise<void> {
    for (const req of requests) await this.create(req);
  }
}
