import { MusicTrack } from '../orchestration/ProductionContracts';

export class InstrumentManager {
  assignInstruments(track: MusicTrack): MusicTrack {
    const extraStem = track.mood === 'action' ? 'brass' : 'strings';
    return {
      ...track,
      stems: [...track.stems, extraStem],
    };
  }
}
