import { MessageBus, BusMessage } from './MessageBus';
import { SyncProtocol, SyncPacket } from './SyncProtocol';

export type RealtimeSyncState = 'idle' | 'syncing' | 'error';

export class RealtimeSync {
  private state: RealtimeSyncState = 'idle';
  private readonly pending: SyncPacket[] = [];

  constructor(
    private readonly bus: MessageBus,
    private readonly protocol: SyncProtocol,
  ) {
    this.bus.subscribe('sync:incoming', (msg: BusMessage) => {
      this.receive(msg.payload as string);
    });
  }

  queue(entityType: string, entityId: string, data: unknown): SyncPacket {
    const packet = this.protocol.update(entityType, entityId, data);
    this.pending.push(packet);
    return packet;
  }

  async flush(): Promise<number> {
    this.state = 'syncing';
    const count = this.pending.length;
    const packets = this.pending.splice(0);
    for (const packet of packets) {
      this.bus.publish('sync:outgoing', this.protocol.serialize(packet));
    }
    this.state = 'idle';
    return count;
  }

  private receive(raw: string): void {
    try {
      this.protocol.deserialize(raw);
    } catch {
      this.state = 'error';
    }
  }

  getState(): RealtimeSyncState {
    return this.state;
  }

  pendingCount(): number {
    return this.pending.length;
  }
}
