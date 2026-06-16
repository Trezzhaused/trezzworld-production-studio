import { AssetGenerationPipeline } from '../assets/AssetGenerationPipeline';
import { AudioExporter } from '../audio/AudioExporter';
import { CharacterVoices } from '../audio/CharacterVoices';
import { DialogueMixer } from '../audio/DialogueMixer';
import { NarrationEngine } from '../audio/NarrationEngine';
import { SFXLibrary } from '../audio/SFXLibrary';
import { VoiceDirector } from '../audio/VoiceDirector';
import { TimelineEditor } from '../editor/TimelineEditor';
import { ArrangementEngine } from '../music/ArrangementEngine';
import { Composer } from '../music/Composer';
import { InstrumentManager } from '../music/InstrumentManager';
import { MasteringEngine } from '../music/MasteringEngine';
import { MixingEngine } from '../music/MixingEngine';
import { MusicExporter } from '../music/MusicExporter';
import { QualityControl } from '../quality/QualityControl';
import { RenderEngine } from '../rendering/RenderEngine';
import { CameraPlanner } from '../video/CameraPlanner';
import { ScenePlanner } from '../video/ScenePlanner';
import { ShotComposer } from '../video/ShotComposer';
import { StoryboardGenerator } from '../video/StoryboardGenerator';
import { SubtitleGenerator } from '../video/SubtitleGenerator';
import { Timeline } from '../video/Timeline';
import { TransitionEngine } from '../video/TransitionEngine';
import { VideoDirector } from '../video/VideoDirector';
import { VideoExporter } from '../video/VideoExporter';
import { VideoOptimizer } from '../video/VideoOptimizer';
import { VideoRenderer } from '../video/VideoRenderer';
import { ExportTarget, ProductionDeliverables, ProductionRequest } from './ProductionContracts';

const defaultTargets: ExportTarget[] = ['4k', '1080p', 'vertical', 'square'];

export class LumiOrchestrator {
  private readonly videoDirector = new VideoDirector();
  private readonly storyboardGenerator = new StoryboardGenerator();
  private readonly scenePlanner = new ScenePlanner();
  private readonly cameraPlanner = new CameraPlanner();
  private readonly shotComposer = new ShotComposer();
  private readonly subtitleGenerator = new SubtitleGenerator();
  private readonly transitionEngine = new TransitionEngine();
  private readonly timeline = new Timeline();
  private readonly timelineEditor = new TimelineEditor();
  private readonly videoRenderer = new VideoRenderer();
  private readonly videoExporter = new VideoExporter();
  private readonly videoOptimizer = new VideoOptimizer();

  private readonly composer = new Composer();
  private readonly arrangementEngine = new ArrangementEngine();
  private readonly instrumentManager = new InstrumentManager();
  private readonly mixingEngine = new MixingEngine();
  private readonly masteringEngine = new MasteringEngine();
  private readonly musicExporter = new MusicExporter();

  private readonly voiceDirector = new VoiceDirector();
  private readonly narrationEngine = new NarrationEngine();
  private readonly characterVoices = new CharacterVoices();
  private readonly dialogueMixer = new DialogueMixer();
  private readonly sfxLibrary = new SFXLibrary();
  private readonly audioExporter = new AudioExporter();

  private readonly assetPipeline = new AssetGenerationPipeline();
  private readonly renderEngine = new RenderEngine();
  private readonly qualityControl = new QualityControl();

  createProduction(input: string): ProductionDeliverables {
    const request = this.parsePrompt(input);
    const projectId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const script = this.videoDirector.generateScript(request);
    const storyboard = this.storyboardGenerator.generate(script);
    const scenes = this.scenePlanner.buildScenes(script);
    const cameraMoves = this.cameraPlanner.plan(scenes);
    const shots = this.shotComposer.compose(scenes, cameraMoves);
    const subtitles = this.subtitleGenerator.generate(script);
    const transitions = this.transitionEngine.build(scenes);

    const rawTimeline = this.timeline.assemble(scenes, transitions, subtitles);
    const editedTimeline = this.timelineEditor.edit(rawTimeline, {
      aiEditing: true,
      automaticTiming: true,
      captions: true,
      motionGraphics: true,
    });

    const composed = this.composer.compose(request);
    const arranged = this.arrangementEngine.arrange(composed);
    const instrumented = this.instrumentManager.assignInstruments(arranged);
    const mixedMusic = this.mixingEngine.mix(instrumented);
    const masteredMusic = this.masteringEngine.master(mixedMusic);

    const cast = this.voiceDirector.castVoices(request);
    const narration = this.narrationEngine.narrate(script, cast);
    const dialogue = this.characterVoices.generateDialogue(script, cast);
    const mixedDialogue = this.dialogueMixer.mix(narration, dialogue);
    const sfx = this.sfxLibrary.select(scenes);

    const assets = this.assetPipeline.generateAll(projectId);

    const renderJob = this.renderEngine.submit(projectId, {
      useGpuWhenAvailable: true,
      allowResume: true,
      batchSize: 4,
    });
    this.renderEngine.run(renderJob.id, editedTimeline);

    const renderPlan = this.videoRenderer.createPlan(projectId, editedTimeline);
    const preview = this.videoRenderer.renderPreview(renderPlan);
    const exported = this.videoExporter.export(projectId, request.exportTargets ?? defaultTargets);
    const optimized = this.videoOptimizer.optimize([preview, ...exported]);
    const renderingArtifacts = [...this.renderEngine.buildArtifacts(projectId), ...optimized];

    const musicArtifacts = this.musicExporter.export(masteredMusic, projectId);
    const audioArtifacts = this.audioExporter.export(projectId, mixedDialogue, sfx);

    const validation = this.qualityControl.validate({
      assets,
      subtitles,
      exports: renderingArtifacts,
      expectedResolution: '3840x2160',
      frameRate: 30,
      audioPeakDb: -1,
    });

    return {
      script,
      storyboard,
      scenes,
      shots,
      subtitles,
      transitions,
      assets,
      music: masteredMusic,
      voice: mixedDialogue,
      sfx,
      videos: renderingArtifacts,
      audio: [...musicArtifacts, ...audioArtifacts],
      thumbnailPath: `exports/${projectId}/thumbnail.png`,
      projectFilePath: `exports/${projectId}/project.lumi.json`,
      validation,
    };
  }

  private parsePrompt(prompt: string): ProductionRequest {
    const minutesMatch = prompt.match(/(\d+)\s*-?\s*minute/i);
    const durationMinutes = Number(minutesMatch?.[1] ?? 5);

    const style: ProductionRequest['style'] = /sci[-\s]?fi/i.test(prompt)
      ? 'sci-fi'
      : /fantasy/i.test(prompt)
        ? 'fantasy'
        : /action/i.test(prompt)
          ? 'action'
          : /documentary/i.test(prompt)
            ? 'documentary'
            : 'cinematic';

    const targets: ExportTarget[] = [];
    if (/4k/i.test(prompt)) {
      targets.push('4k');
    }
    if (/1080p/i.test(prompt)) {
      targets.push('1080p');
    }
    if (/720p/i.test(prompt)) {
      targets.push('720p');
    }
    if (/social|vertical/i.test(prompt)) {
      targets.push('vertical', 'square');
    }

    const exportTargets = Array.from(new Set(targets));

    return {
      prompt,
      durationMinutes,
      style,
      projectTitle: this.extractTitle(prompt),
      exportTargets: exportTargets.length > 0 ? exportTargets : defaultTargets,
    };
  }

  private extractTitle(prompt: string): string {
    const quoted = prompt.match(/"([^"]+)"/);
    if (quoted?.[1]) {
      return quoted[1];
    }

    const trailerMatch = prompt.match(/for\s+my\s+([^,.]+)/i);
    if (trailerMatch?.[1]) {
      return trailerMatch[1].trim();
    }

    return 'LUMI Project';
  }
}
