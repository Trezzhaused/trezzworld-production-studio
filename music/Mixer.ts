import { MusicComposition } from './MusicDirector';

export class Mixer {
  mix(base: MusicComposition): MusicComposition {
    return {
      ...base,
      bpm: Math.max(60, base.bpm),
    };
  }
}
