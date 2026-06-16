import { MusicComposition } from './MusicDirector';

export class RhythmEngine {
  apply(base: MusicComposition): MusicComposition {
    return {
      ...base,
      bpm: base.bpm + 5,
    };
  }
}
