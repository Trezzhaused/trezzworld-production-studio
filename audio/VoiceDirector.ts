import { ProductionRequest } from '../orchestration/ProductionContracts';

export interface VoiceCast {
  narrator: string;
  characters: string[];
}

export class VoiceDirector {
  castVoices(request: ProductionRequest): VoiceCast {
    const style = request.style ?? 'cinematic';
    return {
      narrator: `${style}-narrator`,
      characters: [`${style}-lead`, `${style}-support`],
    };
  }
}
