import { Workspace, WorkspaceProject } from './Workspace';

export interface ProjectValidationResult {
  valid: boolean;
  errors: string[];
}

export class ProjectLoader {
  discover(path: string): WorkspaceProject {
    const name = path.split(/[\\/]/).pop() || 'Project';
    return { id: `${Date.now()}`, name, path };
  }

  validate(project: WorkspaceProject): ProjectValidationResult {
    const errors: string[] = [];
    if (!project.path) errors.push('Project path is required');
    if (!project.name) errors.push('Project name is required');
    return { valid: errors.length === 0, errors };
  }

  load(workspace: Workspace, path: string): WorkspaceProject {
    const project = this.discover(path);
    const result = this.validate(project);
    if (!result.valid) {
      throw new Error(result.errors.join('; '));
    }
    workspace.addProject(project);
    workspace.setActiveProject(project.id);
    return project;
  }
}
