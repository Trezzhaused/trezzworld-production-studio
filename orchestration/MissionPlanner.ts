import { MissionRequest, MissionState, MissionTask } from './Mission';

export class MissionPlanner {
  plan(request: MissionRequest): MissionState {
    const missionId = `mission-${Date.now()}`;
    const tasks = this.buildTasks(request.prompt);

    return {
      id: missionId,
      request,
      tasks,
      status: 'pending',
      iteration: 0,
      memoryUpdates: [],
    };
  }

  private buildTasks(prompt: string): MissionTask[] {
    const base: Array<Pick<MissionTask, 'id' | 'title' | 'capability' | 'dependsOn'>> = [
      { id: 'analyze', title: `Analyze request: ${prompt}`, capability: 'mission-analysis', dependsOn: [] },
      { id: 'script', title: 'Generate script and storyboard', capability: 'video-storyboard', dependsOn: ['analyze'] },
      { id: 'assets', title: 'Generate assets', capability: 'image-assets', dependsOn: ['script'] },
      { id: 'music', title: 'Generate music', capability: 'music-score', dependsOn: ['script'] },
      { id: 'voice', title: 'Generate voices', capability: 'voice-over', dependsOn: ['script'] },
      { id: 'animation', title: 'Generate animations', capability: 'animation-motion', dependsOn: ['assets'] },
      { id: 'timeline', title: 'Assemble timeline', capability: 'media-timeline', dependsOn: ['animation', 'music', 'voice'] },
      { id: 'qa', title: 'Run QA pipeline', capability: 'qa-validation', dependsOn: ['timeline'] },
      { id: 'render', title: 'Render MP4', capability: 'video-render', dependsOn: ['qa'] },
      { id: 'export', title: 'Export package', capability: 'delivery-package', dependsOn: ['render'] },
    ];

    return base.map((task) => ({ ...task, status: 'queued', attempts: 0 }));
  }
}
