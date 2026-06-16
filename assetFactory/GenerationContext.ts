import { AssetCategory } from './AssetRequest';

export interface GenerationContextState {
  sessionId: string;
  workspaceId?: string;
  category: AssetCategory;
  cancelled: boolean;
  progress: number;
  variables: Record<string, unknown>;
  startedAt: string;
}

export class GenerationContext {
  private state: GenerationContextState;

  constructor(sessionId: string, category: AssetCategory) {
    this.state = {
      sessionId,
      category,
      cancelled: false,
      progress: 0,
      variables: {},
      startedAt: new Date().toISOString(),
    };
  }

  setWorkspace(workspaceId: string): void { this.state.workspaceId = workspaceId; }
  setVariable(key: string, value: unknown): void { this.state.variables[key] = value; }
  getVariable(key: string): unknown { return this.state.variables[key]; }
  setProgress(progress: number): void { this.state.progress = Math.max(0, Math.min(100, progress)); }
  cancel(): void { this.state.cancelled = true; }
  isCancelled(): boolean { return this.state.cancelled; }

  getState(): GenerationContextState {
    return { ...this.state, variables: { ...this.state.variables } };
  }
}
