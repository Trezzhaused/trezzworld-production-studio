import { ComponentRegistry } from './ComponentRegistry';
import { ThemeManager } from './ThemeManager';
import { LayoutManager } from './LayoutManager';

export type UIRuntimeState = 'idle' | 'running' | 'stopped';

export class UIRuntime {
  private state: UIRuntimeState = 'idle';

  constructor(
    readonly components: ComponentRegistry,
    readonly theme: ThemeManager,
    readonly layout: LayoutManager,
  ) {}

  start(): UIRuntimeState {
    this.state = 'running';
    return this.state;
  }

  stop(): UIRuntimeState {
    this.state = 'stopped';
    return this.state;
  }

  getState(): UIRuntimeState {
    return this.state;
  }
}
