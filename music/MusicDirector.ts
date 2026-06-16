import { Generator } from '../capability/Generator';

export interface MusicRequest {
  prompt: string;
  durationMinutes: number;
}

export interface MusicComposition {
  chordProgression: string[];
  bpm: number;
}

export class MusicDirector implements Generator<MusicRequest, MusicComposition> {
  readonly id = 'music-director';

  canHandle(input: MusicRequest): boolean {
    return input.durationMinutes > 0;
  }

  async generate(input: MusicRequest): Promise<MusicComposition> {
    return {
      chordProgression: ['i', 'VI', 'III', 'VII'],
      bpm: input.prompt.toLowerCase().includes('action') ? 140 : 100,
    };
  }
}
