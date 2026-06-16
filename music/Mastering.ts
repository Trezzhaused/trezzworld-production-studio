import { MusicComposition } from './MusicDirector';

export class Mastering {
  master(base: MusicComposition): MusicComposition {
    return {
      ...base,
      chordProgression: [...base.chordProgression],
    };
  }
}
