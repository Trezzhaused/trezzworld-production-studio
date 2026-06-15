export interface PublishRecord {
  id: string;
  universeId: string;
  placeId: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  publishedAt: string;
  approved: boolean;
}

export class PublishManager {
  private readonly records: PublishRecord[] = [];

  publish(
    universeId: string,
    placeId: string,
    version: string,
    environment: PublishRecord['environment'] = 'production',
    approved = false,
  ): PublishRecord {
    if (environment === 'production' && !approved) {
      throw new Error('Production publish requires approval');
    }
    const record: PublishRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      universeId,
      placeId,
      version,
      environment,
      publishedAt: new Date().toISOString(),
      approved,
    };
    this.records.push(record);
    return { ...record };
  }

  history(universeId?: string): PublishRecord[] {
    if (!universeId) return [...this.records];
    return this.records.filter(r => r.universeId === universeId).map(r => ({ ...r }));
  }

  latest(universeId: string): PublishRecord | undefined {
    const records = this.history(universeId);
    return records.length > 0 ? records[records.length - 1] : undefined;
  }
}
