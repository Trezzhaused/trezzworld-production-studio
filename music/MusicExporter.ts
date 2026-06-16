import { AudioArtifact, MusicTrack } from '../orchestration/ProductionContracts';

export class MusicExporter {
  export(track: MusicTrack, projectId: string): AudioArtifact[] {
    return [
      {
        id: `${track.id}-mp3`,
        format: 'mp3',
        path: `exports/${projectId}/music-theme.mp3`,
      },
      {
        id: `${track.id}-wav`,
        format: 'wav',
        path: `exports/${projectId}/music-theme.wav`,
      },
    ];
  }
}
