export type LifecycleState =
  | 'initializing'
  | 'starting'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error';

export type LifecycleListener = (state: LifecycleState) => void;

export class Lifecycle {
  private state: LifecycleState = 'initializing';
  private readonly listeners = new Set<LifecycleListener>();

  getState(): LifecycleState { return this.state; }

  transition(next: LifecycleState): void {
    this.state = next;
    for (const l of this.listeners) l(next);
  }

  on(listener: LifecycleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  is(state: LifecycleState): boolean { return this.state === state; }
  isRunning(): boolean { return this.state === 'running'; }
}
