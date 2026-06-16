import { MusicComposition } from './MusicDirector';

export class CompositionEngine {
  arrange(base: MusicComposition): MusicComposition {
    return {
      ...base,
      chordProgression: [...base.chordProgression, 'V'],
    };
  }
}
