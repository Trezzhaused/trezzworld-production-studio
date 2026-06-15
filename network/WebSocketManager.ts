export type WsState = 'connecting' | 'open' | 'closing' | 'closed';

export interface WsMessage {
  id: string;
  event: string;
  payload: unknown;
  sentAt: string;
}

export class WebSocketManager {
  private state: WsState = 'closed';
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();
  private readonly sent: WsMessage[] = [];

  connect(): void {
    this.state = 'connecting';
    this.state = 'open';
  }

  disconnect(): void {
    this.state = 'closing';
    this.state = 'closed';
  }

  on(event: string, handler: (payload: unknown) => void): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler);
    this.listeners.set(event, set);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, payload: unknown): WsMessage {
    if (this.state !== 'open') throw new Error('WebSocket is not open');
    const msg: WsMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      event,
      payload,
      sentAt: new Date().toISOString(),
    };
    this.sent.push(msg);
    this.listeners.get(event)?.forEach(h => h(payload));
    return { ...msg };
  }

  getState(): WsState {
    return this.state;
  }

  sentHistory(): WsMessage[] {
    return [...this.sent];
  }
}
