import type { EventBus } from '../kernel/EventBus';
import type { StateManager } from '../kernel/StateManager';

export interface ExtensionAPIOptions {
  pluginId: string;
  eventBus: EventBus;
  state: StateManager;
}

export class ExtensionAPI {
  private readonly pluginId: string;
  private readonly eventBus: EventBus;
  private readonly state: StateManager;
  private readonly subscriptions: Array<() => void> = [];

  constructor(options: ExtensionAPIOptions) {
    this.pluginId = options.pluginId;
    this.eventBus = options.eventBus;
    this.state = options.state;
  }

  on(event: string, handler: (payload: unknown) => void): void {
    const unsub = this.eventBus.subscribe(event, handler);
    this.subscriptions.push(unsub);
  }

  emit(event: string, payload?: unknown): Promise<void> {
    return this.eventBus.publish(`plugin.${this.pluginId}.${event}`, payload);
  }

  getState<T>(key: string): T | undefined {
    return this.state.get<T>('application', `plugin.${this.pluginId}.${key}`);
  }

  setState(key: string, value: unknown): void {
    this.state.set('application', `plugin.${this.pluginId}.${key}`, value);
  }

  dispose(): void {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
  }
}
