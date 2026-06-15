import { ModuleRegistry } from './ModuleRegistry';
import { ServiceLocator } from './ServiceLocator';
import { EventBus } from './EventBus';
import { Logger } from './Logger';

export type KernelState = 'offline' | 'booting' | 'online' | 'stopping';

export class Kernel {
  private state: KernelState = 'offline';

  constructor(
    readonly modules: ModuleRegistry,
    readonly services: ServiceLocator,
    readonly events: EventBus,
    readonly logger: Logger,
  ) {}

  async boot(): Promise<void> {
    this.state = 'booting';
    this.logger.info('Kernel', 'Booting...');
    await this.events.publish('kernel:boot', {});
    this.state = 'online';
    this.logger.info('Kernel', 'Online');
  }

  async shutdown(): Promise<void> {
    this.state = 'stopping';
    this.logger.info('Kernel', 'Shutting down...');
    await this.events.publish('kernel:shutdown', {});
    this.state = 'offline';
  }

  getState(): KernelState {
    return this.state;
  }
}
