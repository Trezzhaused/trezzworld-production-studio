import { PublishManager, PublishRecord } from '../roblox/PublishManager';
import { CloudSync } from '../roblox/CloudSync';

export interface AutoPublishRequest {
  universeId: string;
  placeId: string;
  version: string;
  approved?: boolean;
}

export interface AutoPublishResult {
  record: PublishRecord;
  syncResult: { success: boolean; changesSynced: number; syncedAt: string };
}

export class AutoPublisher {
  constructor(
    private readonly publisher: PublishManager,
    private readonly sync: CloudSync,
  ) {}

  async publish(request: AutoPublishRequest): Promise<AutoPublishResult> {
    const syncResult = await this.sync.sync();
    const record = this.publisher.publish(
      request.universeId,
      request.placeId,
      request.version,
      'production',
      request.approved ?? false,
    );
    return { record, syncResult };
  }

  history(universeId?: string): PublishRecord[] {
    return this.publisher.history(universeId);
  }
}
