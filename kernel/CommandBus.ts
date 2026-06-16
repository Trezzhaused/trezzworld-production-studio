export interface Command {
  readonly commandType: string;
  [key: string]: unknown;
}

export type CommandHandler<C extends Command = Command, R = void> = (command: C) => Promise<R>;

export class CommandBus {
  private readonly handlers = new Map<string, CommandHandler<Command, unknown>>();

  register<C extends Command, R = void>(type: string, handler: CommandHandler<C, R>): void {
    if (this.handlers.has(type)) throw new Error(`Command handler already registered: ${type}`);
    this.handlers.set(type, handler as CommandHandler<Command, unknown>);
  }

  unregister(type: string): void { this.handlers.delete(type); }

  async dispatch<R = void>(command: Command): Promise<R> {
    const handler = this.handlers.get(command.commandType);
    if (!handler) throw new Error(`No handler for command: ${command.commandType}`);
    return handler(command) as Promise<R>;
  }

  has(type: string): boolean { return this.handlers.has(type); }
  list(): string[] { return [...this.handlers.keys()]; }
}
