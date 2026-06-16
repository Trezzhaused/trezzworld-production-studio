import { VoiceTrack } from './VoiceDirector';

export class NarrationEngine {
  narrate(track: VoiceTrack): string {
    return `${track.narrator}:${track.lines.join(' ')}`;
  }
}
