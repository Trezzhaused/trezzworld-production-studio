import { AnimatorAgent } from '../agent/AnimatorAgent';
import { ArchitectAgent } from '../agent/ArchitectAgent';
import { ArtistAgent } from '../agent/ArtistAgent';
import { DeploymentAgent } from '../agent/DeploymentAgent';
import { DeveloperAgent } from '../agent/DeveloperAgent';
import { DirectorAgent } from '../agent/DirectorAgent';
import { MusicAgent } from '../agent/MusicAgent';
import { QAAgent } from '../agent/QAAgent';
import { VideoAgent } from '../agent/VideoAgent';
import { VoiceAgent } from '../agent/VoiceAgent';
import { CapabilityRegistry } from '../capability/CapabilityRegistry';
import { FallbackRouter } from '../capability/FallbackRouter';
import { ProviderRegistry } from '../capability/ProviderRegistry';
import { ProviderSelector } from '../capability/ProviderSelector';
import { ToolRouter } from '../capability/ToolRouter';
import { MediaDirector } from '../media/MediaDirector';
import { MediaAsset } from '../media/AssetComposer';
import { RenderNode } from '../media/RenderGraph';
import { TimelineSegment } from '../media/TimelineBuilder';
import { MissionOutcome, MissionRequest, MissionState } from './Mission';
import { MissionExecutor } from './MissionExecutor';
import { MissionPlanner } from './MissionPlanner';
import { RecoveryManager } from './RecoveryManager';

export class LUMIDirector {
  private readonly planner = new MissionPlanner();
  private readonly executor = new MissionExecutor();
  private readonly recovery = new RecoveryManager();

  private readonly capabilityRegistry = new CapabilityRegistry();
  private readonly providerRegistry = new ProviderRegistry();
  private readonly providerSelector = new ProviderSelector(this.providerRegistry);
  private readonly toolRouter = new ToolRouter(this.providerSelector);
  private readonly fallbackRouter = new FallbackRouter();

  private readonly mediaDirector = new MediaDirector();

  private readonly agents = {
    DirectorAgent: new DirectorAgent(),
    ArchitectAgent: new ArchitectAgent(),
    DeveloperAgent: new DeveloperAgent(),
    ArtistAgent: new ArtistAgent(),
    AnimatorAgent: new AnimatorAgent(),
    MusicAgent: new MusicAgent(),
    VoiceAgent: new VoiceAgent(),
    VideoAgent: new VideoAgent(),
    QAAgent: new QAAgent(),
    DeploymentAgent: new DeploymentAgent(),
  };

  constructor() {
    this.bootstrapCapabilities();
    this.bootstrapProviders();
    this.bootstrapFallbacks();
  }

  run(request: MissionRequest): MissionOutcome {
    let mission = this.planner.plan(request);
    mission.status = 'running';

    while (!this.goalComplete(mission)) {
      mission = this.plan(mission);
      mission = this.execute(mission);
      mission = this.review(mission);
      mission = this.repair(mission);
      mission = this.retry(mission);
      mission = this.improve(mission);

      if (mission.iteration > 6) {
        mission.status = 'failed';
        break;
      }
    }

    const projectId = mission.request.projectId ?? mission.id;
    const media = this.mediaDirector.produce(projectId, this.mockMediaInput());

    return {
      missionId: mission.id,
      status: mission.status,
      deliverables: [...media.package.videos, ...media.package.audio, media.package.project, media.package.thumbnail],
      qaPassed: mission.tasks.every((task) => task.status === 'done'),
      iterations: mission.iteration,
      summary: `Mission ${mission.status} after ${mission.iteration} loops with ${mission.tasks.length} tasks.`,
    };
  }

  private goalComplete(mission: MissionState): boolean {
    return mission.status === 'completed' || mission.status === 'failed';
  }

  private plan(mission: MissionState): MissionState {
    mission.tasks.forEach((task) => {
      const route = this.toolRouter.route(task.capability);
      if (route.route === 'fallback') {
        task.capability = this.fallbackRouter.resolve(task.capability);
      }
    });
    return mission;
  }

  private execute(mission: MissionState): MissionState {
    return this.executor.run(mission, this.agents);
  }

  private review(mission: MissionState): MissionState {
    const hasErrors = mission.tasks.some((task) => task.status === 'error');
    mission.status = hasErrors ? 'running' : mission.status;
    return mission;
  }

  private repair(mission: MissionState): MissionState {
    mission.tasks = mission.tasks.map((task) => (task.status === 'error' ? this.recovery.recover(task) : task));
    return mission;
  }

  private retry(mission: MissionState): MissionState {
    const queued = mission.tasks.filter((task) => task.status === 'queued').length;
    if (queued > 0) {
      mission.status = 'running';
    }
    return mission;
  }

  private improve(mission: MissionState): MissionState {
    mission.memoryUpdates.push(`iteration-${mission.iteration}: updated planning heuristics`);
    return mission;
  }

  private bootstrapCapabilities(): void {
    [
      'mission-analysis',
      'video-storyboard',
      'image-assets',
      'music-score',
      'voice-over',
      'animation-motion',
      'media-timeline',
      'qa-validation',
      'video-render',
      'delivery-package',
      'generic-generator',
    ].forEach((capability) => this.capabilityRegistry.register(capability));
  }

  private bootstrapProviders(): void {
    this.providerRegistry.register({
      id: 'local-runtime',
      kind: 'local',
      capabilities: ['mission-analysis', 'media-timeline', 'qa-validation', 'delivery-package'],
      healthy: true,
      costRank: 1,
    });

    this.providerRegistry.register({
      id: 'cloud-creative',
      kind: 'cloud',
      capabilities: ['video-storyboard', 'image-assets', 'animation-motion', 'video-render'],
      healthy: true,
      costRank: 2,
    });

    this.providerRegistry.register({
      id: 'commercial-audio',
      kind: 'commercial',
      capabilities: ['music-score', 'voice-over'],
      healthy: true,
      costRank: 3,
    });

    this.providerRegistry.register({
      id: 'future-adapter',
      kind: 'future',
      capabilities: ['generic-generator'],
      healthy: true,
      costRank: 4,
    });
  }

  private bootstrapFallbacks(): void {
    this.fallbackRouter.setFallback('video-storyboard', 'generic-generator');
    this.fallbackRouter.setFallback('image-assets', 'generic-generator');
    this.fallbackRouter.setFallback('music-score', 'generic-generator');
    this.fallbackRouter.setFallback('voice-over', 'generic-generator');
  }

  private mockMediaInput(): { assets: MediaAsset[]; graph: RenderNode[]; timeline: TimelineSegment[] } {
    return {
      assets: [
        { id: 'asset-1', kind: 'image', path: 'assets/scene-1.png' },
        { id: 'asset-2', kind: 'audio', path: 'assets/score.mp3' },
      ],
      graph: [
        { id: 'node-1', type: 'asset', dependsOn: [] },
        { id: 'node-2', type: 'video', dependsOn: ['node-1'] },
      ],
      timeline: [
        { id: 'segment-1', startSeconds: 0, durationSeconds: 15, track: 'video' },
        { id: 'segment-2', startSeconds: 0, durationSeconds: 15, track: 'audio' },
      ],
    };
  }
}
