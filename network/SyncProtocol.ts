export type SyncOperation = 'create' | 'update' | 'delete' | 'patch';

export interface SyncPacket {
  id: string;
  operation: SyncOperation;
  entityType: string;
  entityId: string;
  data?: unknown;
  timestamp: string;
  version: number;
}

export class SyncProtocol {
  private version = 0;
  private readonly log: SyncPacket[] = [];

  create(entityType: string, entityId: string, data: unknown): SyncPacket {
    return this.pack('create', entityType, entityId, data);
  }

  update(entityType: string, entityId: string, data: unknown): SyncPacket {
    return this.pack('update', entityType, entityId, data);
  }

  delete(entityType: string, entityId: string): SyncPacket {
    return this.pack('delete', entityType, entityId);
  }

  patch(entityType: string, entityId: string, data: unknown): SyncPacket {
    return this.pack('patch', entityType, entityId, data);
  }

  serialize(packet: SyncPacket): string {
    return JSON.stringify(packet);
  }

  deserialize(raw: string): SyncPacket {
    return JSON.parse(raw) as SyncPacket;
  }

  getLog(): SyncPacket[] {
    return [...this.log];
  }

  private pack(operation: SyncOperation, entityType: string, entityId: string, data?: unknown): SyncPacket {
    const packet: SyncPacket = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      operation,
      entityType,
      entityId,
      data,
      timestamp: new Date().toISOString(),
      version: ++this.version,
    };
    this.log.push(packet);
    return { ...packet };
  }
}
