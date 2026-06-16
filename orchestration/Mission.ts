export type MissionStatus = 'pending' | 'running' | 'completed' | 'failed';
export type TaskStatus = 'queued' | 'scheduled' | 'running' | 'done' | 'error';

export interface MissionRequest {
  prompt: string;
  userId?: string;
  projectId?: string;
}

export interface MissionTask {
  id: string;
  title: string;
  capability: string;
  dependsOn: string[];
  status: TaskStatus;
  attempts: number;
}

export interface MissionState {
  id: string;
  request: MissionRequest;
  tasks: MissionTask[];
  status: MissionStatus;
  iteration: number;
  memoryUpdates: string[];
}

export interface MissionOutcome {
  missionId: string;
  status: MissionStatus;
  deliverables: string[];
  qaPassed: boolean;
  iterations: number;
  summary: string;
}
