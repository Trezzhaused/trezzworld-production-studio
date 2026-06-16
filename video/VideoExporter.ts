import { ExportTarget, RenderArtifact } from '../orchestration/ProductionContracts';

const resolutionByTarget: Record<ExportTarget, string> = {
  '4k': '3840x2160',
  '1080p': '1920x1080',
  '720p': '1280x720',
  vertical: '1080x1920',
  square: '1080x1080',
};

export class VideoExporter {
  export(projectId: string, targets: ExportTarget[]): RenderArtifact[] {
    return targets.map((target) => ({
      id: `${projectId}-${target}`,
      target,
      resolution: resolutionByTarget[target],
      format: 'mp4',
      path: `exports/${projectId}/video-${target}.mp4`,
    }));
  }
}
