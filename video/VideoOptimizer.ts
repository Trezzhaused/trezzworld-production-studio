import { RenderArtifact } from '../orchestration/ProductionContracts';

export class VideoOptimizer {
  optimize(artifacts: RenderArtifact[]): RenderArtifact[] {
    return artifacts.map((artifact) => ({
      ...artifact,
      path: artifact.path.replace('.mp4', '.optimized.mp4'),
    }));
  }
}
