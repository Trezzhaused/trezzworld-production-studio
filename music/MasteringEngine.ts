import { MusicTrack } from '../orchestration/ProductionContracts';

export class MasteringEngine {
  master(track: MusicTrack): MusicTrack {
    return {
      ...track,
      title: `${track.title} (Mastered)`,
    };
  }
}
