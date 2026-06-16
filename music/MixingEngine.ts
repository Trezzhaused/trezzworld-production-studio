import { MusicTrack } from '../orchestration/ProductionContracts';

export class MixingEngine {
  mix(track: MusicTrack): MusicTrack {
    return {
      ...track,
      title: `${track.title} (Mixed)`,
    };
  }
}
