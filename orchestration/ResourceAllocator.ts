import { MissionTask } from './Mission';

export interface Allocation {
  taskId: string;
  agentRole: string;
}

export class ResourceAllocator {
  allocate(tasks: MissionTask[]): Allocation[] {
    return tasks.map((task) => ({
      taskId: task.id,
      agentRole: this.mapCapabilityToAgent(task.capability),
    }));
  }

  private mapCapabilityToAgent(capability: string): string {
    if (capability.includes('video')) return 'VideoAgent';
    if (capability.includes('music')) return 'MusicAgent';
    if (capability.includes('voice')) return 'VoiceAgent';
    if (capability.includes('image') || capability.includes('model') || capability.includes('animation')) return 'ArtistAgent';
    if (capability.includes('qa')) return 'QAAgent';
    return 'DeveloperAgent';
  }
}
