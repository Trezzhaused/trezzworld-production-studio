import { AssetCategory } from './AssetRequest';

export type GenerationJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJobResult {
  assetId: string;
  assetPath: string;
  generatedAt: string;
}

export interface GenerationJob {
  id: string;
  category: AssetCategory;
  prompt: string;
  priority: number;
  status: GenerationJobStatus;
  result?: GenerationJobResult;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export class GenerationJobFactory {
  create(category: AssetCategory, prompt: string, priority = 0): GenerationJob {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      category,
      prompt,
      priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  start(job: GenerationJob): GenerationJob {
    return { ...job, status: 'running', startedAt: new Date().toISOString() };
  }

  complete(job: GenerationJob, result: GenerationJobResult): GenerationJob {
    return { ...job, status: 'completed', result, completedAt: new Date().toISOString() };
  }

  fail(job: GenerationJob, error: string): GenerationJob {
    return { ...job, status: 'failed', error, completedAt: new Date().toISOString() };
  }
}
