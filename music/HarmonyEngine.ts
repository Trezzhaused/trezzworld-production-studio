import { MusicComposition } from './MusicDirector';

export class HarmonyEngine {
  apply(base: MusicComposition): MusicComposition {
    return {
      ...base,
      chordProgression: base.chordProgression.map((chord) => `${chord}maj`),
    };
  }
}
