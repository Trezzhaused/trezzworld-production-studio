export interface ExecutionContextState {
  workspaceId?: string;
  universeId?: string;
  deploymentId?: string;
  cancelled: boolean;
  progress: number;
  variables: Record<string, unknown>;
}

export class ExecutionContext {
  private state: ExecutionContextState = {
    cancelled: false,
    progress: 0,
    variables: {},
  };

  setWorkspace(workspaceId: string): void { this.state.workspaceId = workspaceId; }
  setUniverse(universeId: string): void { this.state.universeId = universeId; }
  setDeployment(deploymentId: string): void { this.state.deploymentId = deploymentId; }
  setVariable(key: string, value: unknown): void { this.state.variables[key] = value; }
  getVariable(key: string): unknown { return this.state.variables[key]; }
  setProgress(progress: number): void { this.state.progress = Math.max(0, Math.min(100, progress)); }
  cancel(): void { this.state.cancelled = true; }
  getState(): ExecutionContextState {
    return { ...this.state, variables: { ...this.state.variables } };
  }
}
