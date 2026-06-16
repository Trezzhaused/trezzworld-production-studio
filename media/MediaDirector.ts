import { MediaExporter, MediaPackage } from './MediaExporter';
import { MediaPipeline, MediaPipelineInput } from './MediaPipeline';

export class MediaDirector {
  private readonly pipeline = new MediaPipeline();
  private readonly exporter = new MediaExporter();

  produce(projectId: string, input: MediaPipelineInput): { package: MediaPackage; stageCount: number } {
    const assembled = this.pipeline.assemble(input);
    const pkg = this.exporter.export(projectId);

    return {
      package: pkg,
      stageCount: assembled.assets.length + assembled.graph.length + assembled.timeline.length,
    };
  }
}
