export type PipelineStage='requested'|'validated'|'optimized'|'previewed'|'stored';

export interface PipelineResult {
  success:boolean;
  stages:PipelineStage[];
  completedAt:string;
}

export class AssetPipeline {
  private stages:PipelineStage[]=[];

  run():PipelineResult {
    this.stages=['requested','validated','optimized','previewed','stored'];
    return {
      success:true,
      stages:[...this.stages],
      completedAt:new Date().toISOString(),
    };
  }

  getStages():PipelineStage[]{
    return [...this.stages];
  }
}
