import { Kernel } from './Kernel';
import { ModuleRegistry } from './ModuleRegistry';
import { ServiceLocator } from './ServiceLocator';
import { EventBus } from './EventBus';
import { Logger } from './Logger';
import { Configuration } from './Configuration';

export type AppState = 'created' | 'starting' | 'running' | 'stopping' | 'stopped';

export class Application {
  private state: AppState = 'created';
  readonly kernel: Kernel;
  readonly config: Configuration;

  constructor(config: Configuration) {
    this.config = config;
    const logger = new Logger();
    const events = new EventBus();
    const modules = new ModuleRegistry();
    const services = new ServiceLocator();
    this.kernel = new Kernel(modules, services, events, logger);
  }

  async start(): Promise<void> {
    this.state = 'starting';
    await this.kernel.boot();
    this.state = 'running';
  }

  async stop(): Promise<void> {
    this.state = 'stopping';
    await this.kernel.shutdown();
    this.state = 'stopped';
  }

  getState(): AppState {
    return this.state;
  }
}
