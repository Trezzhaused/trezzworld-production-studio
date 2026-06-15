export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'manual' | 'merge';

export interface SyncConflict {
  id: string;
  target: string;
  localHash: string;
  remoteHash: string;
  detectedAt: string;
}

export interface ResolutionResult {
  resolved: boolean;
  strategy: ConflictStrategy;
  message: string;
}

export class ConflictResolver {
  detect(target:string, localHash:string, remoteHash:string): SyncConflict | null {
    if (localHash === remoteHash) return null;
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      target,
      localHash,
      remoteHash,
      detectedAt: new Date().toISOString(),
    };
  }

  resolve(conflict: SyncConflict, strategy: ConflictStrategy): ResolutionResult {
    return {
      resolved: true,
      strategy,
      message: `Resolved conflict for ${conflict.target} using ${strategy}`,
    };
  }
}
