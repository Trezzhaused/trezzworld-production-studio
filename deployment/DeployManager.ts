import { RobloxPublisher, PublishOptions, PublishResult } from './RobloxPublisher';
import { VersionManager } from './VersionManager';
import { ReleaseManager } from './ReleaseManager';
import { RollbackManager } from './RollbackManager';
import { CloudSync } from './CloudSync';

export type DeployStatus = 'idle' | 'deploying' | 'deployed' | 'failed';

export interface DeployOptions extends PublishOptions {
  releaseName?: string;
  releaseNotes?: string;
}

export interface DeployResult {
  deployId: string;
  status: DeployStatus;
  versionString: string;
  publishResult?: PublishResult;
  durationMs: number;
  error?: string;
}

export class DeployManager {
  readonly publisher = new RobloxPublisher();
  readonly versions = new VersionManager();
  readonly releases = new ReleaseManager();
  readonly rollback = new RollbackManager();
  readonly cloudSync = new CloudSync();

  private status: DeployStatus = 'idle';

  getStatus(): DeployStatus { return this.status; }

  async deploy(data: Uint8Array | string, options: DeployOptions = {}): Promise<DeployResult> {
    const deployId = `deploy-${Date.now()}`;
    const start = Date.now();
    this.status = 'deploying';

    const version = this.versions.bump('patch');
    const versionString = this.versions.getString();
    this.rollback.snapshot(version.id, data, versionString);

    const { releaseName, releaseNotes, ...publishOptions } = options;
    const release = this.releases.create(releaseName ?? versionString, versionString, releaseNotes);

    try {
      const publishResult = await this.publisher.publish(data, publishOptions);
      if (!publishResult.success) {
        this.status = 'failed';
        return { deployId, status: 'failed', versionString, publishResult, durationMs: Date.now() - start, error: publishResult.error };
      }
      this.releases.publish(release.id);
      await this.cloudSync.push({ versionString, deployId });
      this.status = 'deployed';
      return { deployId, status: 'deployed', versionString, publishResult, durationMs: Date.now() - start };
    } catch (err) {
      this.status = 'failed';
      return { deployId, status: 'failed', versionString, durationMs: Date.now() - start, error: (err as Error).message };
    }
  }
}
