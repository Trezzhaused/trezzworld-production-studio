import { VoiceTrack } from '../orchestration/ProductionContracts';
import { CharacterLine } from './CharacterVoices';

export class DialogueMixer {
  mix(narration: VoiceTrack, dialogue: CharacterLine[]): VoiceTrack {
    const dialogueBlock = dialogue.map((line) => `${line.speaker}: ${line.line}`).join('\n');

    return {
      ...narration,
      transcript: `${narration.transcript}\n${dialogueBlock}`,
    };
  }
}
