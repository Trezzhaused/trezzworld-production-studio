export interface BusMessage<T = unknown> {
  id: string;
  topic: string;
  payload: T;
  publishedAt: string;
}

export class MessageBus {
  private readonly subscribers = new Map<string, Set<(msg: BusMessage) => void>>();
  private readonly history: BusMessage[] = [];

  subscribe(topic: string, handler: (msg: BusMessage) => void): () => void {
    const set = this.subscribers.get(topic) ?? new Set();
    set.add(handler);
    this.subscribers.set(topic, set);
    return () => this.subscribers.get(topic)?.delete(handler);
  }

  publish<T = unknown>(topic: string, payload: T): BusMessage<T> {
    const msg: BusMessage<T> = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      topic,
      payload,
      publishedAt: new Date().toISOString(),
    };
    this.history.push(msg as BusMessage);
    this.subscribers.get(topic)?.forEach(h => h(msg as BusMessage));
    return msg;
  }

  getHistory(topic?: string): BusMessage[] {
    if (!topic) return [...this.history];
    return this.history.filter(m => m.topic === topic);
  }

  clearHistory(): void {
    this.history.length = 0;
  }
}
