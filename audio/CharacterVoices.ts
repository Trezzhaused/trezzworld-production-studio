import { ScriptSegment } from '../orchestration/ProductionContracts';
import { VoiceCast } from './VoiceDirector';

export interface CharacterLine {
  speaker: string;
  line: string;
}

export class CharacterVoices {
  generateDialogue(script: ScriptSegment[], voiceCast: VoiceCast): CharacterLine[] {
    return script.map((segment, index) => ({
      speaker: voiceCast.characters[index % voiceCast.characters.length],
      line: segment.text,
    }));
  }
}
