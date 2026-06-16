import { MissionTask } from '../orchestration/Mission';

export interface AgentResult {
  taskId: string;
  output: string;
}

export abstract class BaseAgent {
  constructor(public readonly role: string) {}

  execute(task: MissionTask): AgentResult {
    return {
      taskId: task.id,
      output: `${this.role} executed ${task.title}`,
    };
  }
}
