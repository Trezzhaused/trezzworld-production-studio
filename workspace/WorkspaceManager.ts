import { Workspace, WorkspaceModel } from './Workspace';

export class WorkspaceManager {
  private current?: Workspace;

  create(model: WorkspaceModel): Workspace {
    this.current = new Workspace(model);
    return this.current;
  }

  open(serialized: string): Workspace {
    this.current = Workspace.deserialize(serialized);
    return this.current;
  }

  save(): string {
    if (!this.current) throw new Error('No active workspace');
    return this.current.serialize();
  }

  close(): void {
    this.current = undefined;
  }

  getCurrent(): Workspace | undefined {
    return this.current;
  }
}
