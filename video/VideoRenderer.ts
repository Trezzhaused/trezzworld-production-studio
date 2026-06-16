import { RenderArtifact, TimelineClip } from '../orchestration/ProductionContracts';

interface RenderPlan {
  id: string;
  timeline: TimelineClip[];
  fps: number;
  baseResolution: string;
}

export class VideoRenderer {
  createPlan(projectId: string, timeline: TimelineClip[]): RenderPlan {
    return {
      id: `render-${projectId}`,
      timeline,
      fps: 30,
      baseResolution: '3840x2160',
    };
  }

  renderPreview(plan: RenderPlan): RenderArtifact {
    return {
      id: `${plan.id}-preview`,
      target: '1080p',
      resolution: '1920x1080',
      format: 'mp4',
      path: `exports/${plan.id}/preview-1080p.mp4`,
    };
  }
}
