import { MusicTrack } from '../orchestration/ProductionContracts';

export class ArrangementEngine {
  arrange(track: MusicTrack): MusicTrack {
    return {
      ...track,
      stems: [...track.stems, 'pads', 'fx'],
    };
  }
}
