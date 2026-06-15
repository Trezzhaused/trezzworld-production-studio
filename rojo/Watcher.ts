export interface WatchEvent {
  id: string;
  path: string;
  type: 'created' | 'modified' | 'deleted';
  timestamp: string;
}

export class Watcher {
  private readonly events: WatchEvent[] = [];

  record(path: string, type: WatchEvent['type']): WatchEvent {
    const event: WatchEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      path,
      type,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  flush(): WatchEvent[] {
    const out = [...this.events];
    this.events.length = 0;
    return out;
  }

  pending(): WatchEvent[] {
    return [...this.events];
  }
}
