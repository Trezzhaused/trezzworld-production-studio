import { AudioArtifact, SFXTrack, VoiceTrack } from '../orchestration/ProductionContracts';

export class AudioExporter {
  export(projectId: string, voice: VoiceTrack, sfx: SFXTrack): AudioArtifact[] {
    return [
      {
        id: `${voice.id}-master`,
        format: 'wav',
        path: `exports/${projectId}/voice-master.wav`,
      },
      {
        id: `${sfx.id}-fx`,
        format: 'mp3',
        path: `exports/${projectId}/sfx-bed.mp3`,
      },
    ];
  }
}
