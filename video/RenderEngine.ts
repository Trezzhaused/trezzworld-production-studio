export interface RenderJob {
  id: string;
  progress: number;
  status: 'queued' | 'running' | 'done';
}

export class RenderEngine {
  start(projectId: string): RenderJob {
    return {
      id: `render-${projectId}`,
      progress: 100,
      status: 'done',
    };
  }
}
