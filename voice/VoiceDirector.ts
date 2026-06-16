import { Generator } from '../capability/Generator';

export interface VoiceRequest {
  script: string[];
}

export interface VoiceTrack {
  narrator: string;
  lines: string[];
}

export class VoiceDirector implements Generator<VoiceRequest, VoiceTrack> {
  readonly id = 'voice-director';

  canHandle(input: VoiceRequest): boolean {
    return input.script.length > 0;
  }

  async generate(input: VoiceRequest): Promise<VoiceTrack> {
    return {
      narrator: 'cinematic-narrator',
      lines: input.script,
    };
  }
}
