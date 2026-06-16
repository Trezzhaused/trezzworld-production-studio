import { VoiceTrack } from './VoiceDirector';

export class DialogueEngine {
  createDialogues(track: VoiceTrack): string[] {
    return track.lines.map((line, index) => `character-${(index % 2) + 1}: ${line}`);
  }
}
