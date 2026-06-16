export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  subscribe<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    const set = this.handlers.get(event) ?? new Set<EventHandler>();
    set.add(handler as EventHandler);
    this.handlers.set(event, set);
    return () => this.unsubscribe(event, handler);
  }

  unsubscribe<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  async publish<T = unknown>(event: string, payload: T): Promise<void> {
    const listeners = this.handlers.get(event);
    if (!listeners) return;
    for (const listener of listeners) await listener(payload);
  }

  once<T = unknown>(event: string, handler: EventHandler<T>): void {
    const wrapper: EventHandler<T> = async (payload) => {
      this.unsubscribe(event, wrapper);
      await handler(payload);
    };
    this.subscribe(event, wrapper);
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  clear(event?: string): void {
    if (event) this.handlers.delete(event);
    else this.handlers.clear();
  }
}
