import { Bootstrap } from './Bootstrap';
import { Lifecycle } from './Lifecycle';
import { ServiceContainer } from './ServiceContainer';
import { EventBus } from './EventBus';
import { Scheduler } from './Scheduler';
import { Configuration } from './Configuration';
import { ModuleLoader } from './ModuleLoader';
import { Logger } from './Logger';
import { HealthMonitor } from './HealthMonitor';
import { ShutdownManager } from './ShutdownManager';
import { CommandBus } from './CommandBus';
import { QueryBus } from './QueryBus';
import { StateManager } from './StateManager';
import { ExtensionHost } from './ExtensionHost';
import { Telemetry } from './Telemetry';

export class Kernel {
  readonly lifecycle = new Lifecycle();
  readonly container = new ServiceContainer();
  readonly eventBus = new EventBus();
  readonly scheduler = new Scheduler();
  readonly config = new Configuration();
  readonly moduleLoader = new ModuleLoader();
  readonly logger = new Logger();
  readonly health = new HealthMonitor();
  readonly shutdown = new ShutdownManager();
  readonly commandBus = new CommandBus();
  readonly queryBus = new QueryBus();
  readonly state = new StateManager();
  readonly extensions = new ExtensionHost();
  readonly telemetry = new Telemetry();
  readonly bootstrap = new Bootstrap();

  private running = false;

  async start(configOverrides?: Record<string, unknown>): Promise<void> {
    try {
      this.lifecycle.transition('initializing');
      this.logger.info('[Kernel] Loading configuration');
      if (configOverrides) this.config.load(configOverrides);

      this.lifecycle.transition('starting');
      this.logger.info('[Kernel] Registering core services');
      this._registerCoreServices();

      this.logger.info('[Kernel] Initialising bootstrap modules');
      await this.bootstrap.start();

      this.logger.info('[Kernel] Registering shutdown hooks');
      this._registerShutdownHooks();

      this.logger.info('[Kernel] Starting scheduler');
      this.scheduler.startAll();

      this.lifecycle.transition('running');
      this.running = true;
      this.logger.info('[Kernel] Running');
      this.telemetry.track('kernel.started');
    } catch (err) {
      this.lifecycle.transition('error');
      this.logger.error('[Kernel] Startup failed', err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.lifecycle.transition('stopping');
    this.logger.info('[Kernel] Shutting down');
    this.scheduler.stopAll();
    await this.extensions.deactivateAll();
    await this.shutdown.shutdown();
    this.lifecycle.transition('stopped');
    this.running = false;
    this.logger.info('[Kernel] Stopped');
    this.telemetry.track('kernel.stopped');
  }

  isRunning(): boolean { return this.running; }

  private _registerCoreServices(): void {
    this.container.registerInstance('eventBus', this.eventBus);
    this.container.registerInstance('scheduler', this.scheduler);
    this.container.registerInstance('config', this.config);
    this.container.registerInstance('moduleLoader', this.moduleLoader);
    this.container.registerInstance('logger', this.logger);
    this.container.registerInstance('health', this.health);
    this.container.registerInstance('commandBus', this.commandBus);
    this.container.registerInstance('queryBus', this.queryBus);
    this.container.registerInstance('state', this.state);
    this.container.registerInstance('extensions', this.extensions);
    this.container.registerInstance('telemetry', this.telemetry);
  }

  private _registerShutdownHooks(): void {
    this.shutdown.register('scheduler', async () => this.scheduler.stopAll());
    this.shutdown.register('extensions', async () => { await this.extensions.deactivateAll(); });
    this.shutdown.register('telemetry', async () => { this.telemetry.flush(); });
    this.shutdown.register('logger', async () => { this.logger.info('[Kernel] Shutdown complete'); });
  }
}
