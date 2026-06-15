export type DeploymentEnvironment = 'development' | 'staging' | 'production';

export type DeploymentStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'rolled-back';

export interface DeploymentJob {
  id: string;
  version: string;
  environment: DeploymentEnvironment;
  status: DeploymentStatus;
  createdAt: string;
}

export class DeploymentManager {
  private jobs: DeploymentJob[] = [];

  createDeployment(version: string, environment: DeploymentEnvironment): DeploymentJob {
    const job: DeploymentJob = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      version,
      environment,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.jobs.push(job);
    return { ...job };
  }

  updateStatus(id: string, status: DeploymentStatus): DeploymentJob {
    const job = this.jobs.find(j => j.id === id);
    if (!job) throw new Error(`Deployment not found: ${id}`);
    job.status = status;
    return { ...job };
  }

  list(): DeploymentJob[] {
    return [...this.jobs];
  }

  latest(): DeploymentJob | undefined {
    return this.jobs.at(-1);
  }
}
