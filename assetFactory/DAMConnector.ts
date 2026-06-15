export interface DAMAssetReference {
  id: string;
  assetId: string;
  location: string;
  version: string;
  synchronizedAt: string;
}

export interface DAMSyncResult {
  success: boolean;
  operation: 'upload' | 'download' | 'sync';
  reference: DAMAssetReference;
}

export class DAMConnector {
  private makeResult(operation:'upload'|'download'|'sync', assetId:string, location:string, version:string): DAMSyncResult {
    return {
      success: true,
      operation,
      reference: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        assetId,
        location,
        version,
        synchronizedAt: new Date().toISOString(),
      },
    };
  }

  upload(assetId:string, location:string, version:string): DAMSyncResult {
    return this.makeResult('upload', assetId, location, version);
  }

  download(assetId:string, location:string, version:string): DAMSyncResult {
    return this.makeResult('download', assetId, location, version);
  }

  sync(assetId:string, location:string, version:string): DAMSyncResult {
    return this.makeResult('sync', assetId, location, version);
  }
}
