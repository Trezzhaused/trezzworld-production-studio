import { MissionTask } from './Mission';

export class RecoveryManager {
  recover(task: MissionTask): MissionTask {
    return {
      ...task,
      status: 'queued',
    };
  }
}
