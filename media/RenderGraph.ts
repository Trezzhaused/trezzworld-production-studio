export interface RenderNode {
  id: string;
  type: 'asset' | 'video' | 'audio' | 'subtitle' | 'effect';
  dependsOn: string[];
}

export class RenderGraph {
  build(nodes: RenderNode[]): RenderNode[] {
    return nodes;
  }
}
