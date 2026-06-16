export interface ProductionRequest {
  prompt: string;
  durationMinutes: number;
  projectTitle?: string;
  style?: 'cinematic' | 'documentary' | 'action' | 'fantasy' | 'sci-fi';
  exportTargets?: ExportTarget[];
}

export type ExportTarget = '4k' | '1080p' | '720p' | 'vertical' | 'square';

export interface ScriptSegment {
  id: string;
  text: string;
  durationSeconds: number;
}

export interface StoryboardFrame {
  id: string;
  sceneId: string;
  description: string;
}

export interface Scene {
  id: string;
  title: string;
  objective: string;
  durationSeconds: number;
}

export interface CameraMove {
  sceneId: string;
  movement: 'static' | 'dolly' | 'pan' | 'tilt' | 'drone';
  focalLengthMm: number;
}

export interface Shot {
  id: string;
  sceneId: string;
  direction: string;
  durationSeconds: number;
}

export interface SubtitleCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface Transition {
  fromSceneId: string;
  toSceneId: string;
  style: 'cut' | 'fade' | 'wipe';
  durationSeconds: number;
}

export interface TimelineClip {
  id: string;
  type: 'video' | 'audio' | 'subtitle' | 'effect' | 'title';
  startSeconds: number;
  durationSeconds: number;
  payload: Record<string, unknown>;
}

export interface MusicTrack {
  id: string;
  title: string;
  mood: string;
  durationSeconds: number;
  stems: string[];
}

export interface VoiceTrack {
  id: string;
  narrator: string;
  durationSeconds: number;
  transcript: string;
}

export interface SFXTrack {
  id: string;
  effects: string[];
  durationSeconds: number;
}

export interface AssetItem {
  id: string;
  kind: 'character' | 'background' | 'prop' | 'ui' | 'logo' | 'icon' | 'texture' | 'animation';
  name: string;
  uri: string;
}

export interface RenderArtifact {
  id: string;
  target: ExportTarget;
  resolution: string;
  format: 'mp4';
  path: string;
}

export interface AudioArtifact {
  id: string;
  format: 'mp3' | 'wav';
  path: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface ProductionDeliverables {
  script: ScriptSegment[];
  storyboard: StoryboardFrame[];
  scenes: Scene[];
  shots: Shot[];
  subtitles: SubtitleCue[];
  transitions: Transition[];
  assets: AssetItem[];
  music: MusicTrack;
  voice: VoiceTrack;
  sfx: SFXTrack;
  videos: RenderArtifact[];
  audio: AudioArtifact[];
  thumbnailPath: string;
  projectFilePath: string;
  validation: ValidationReport;
}
