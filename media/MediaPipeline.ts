import { AssetComposer, MediaAsset } from './AssetComposer';
import { RenderGraph, RenderNode } from './RenderGraph';
import { TimelineBuilder, TimelineSegment } from './TimelineBuilder';

export interface MediaPipelineInput {
  assets: MediaAsset[];
  graph: RenderNode[];
  timeline: TimelineSegment[];
}

export class MediaPipeline {
  private readonly composer = new AssetComposer();
  private readonly graph = new RenderGraph();
  private readonly timelineBuilder = new TimelineBuilder();

  assemble(input: MediaPipelineInput): {
    assets: MediaAsset[];
    graph: RenderNode[];
    timeline: TimelineSegment[];
  } {
    return {
      assets: this.composer.compose(input.assets),
      graph: this.graph.build(input.graph),
      timeline: this.timelineBuilder.build(input.timeline),
    };
  }
}
