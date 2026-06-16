import { ScriptSegment, VoiceTrack } from '../orchestration/ProductionContracts';
import { VoiceCast } from './VoiceDirector';

export class NarrationEngine {
  narrate(script: ScriptSegment[], voiceCast: VoiceCast): VoiceTrack {
    const transcript = script.map((segment) => segment.text).join('\n');
    const durationSeconds = script.reduce((total, segment) => total + segment.durationSeconds, 0);

    return {
      id: `voice-${Date.now()}`,
      narrator: voiceCast.narrator,
      durationSeconds,
      transcript,
    };
  }
}
