export interface Command {
  id: string;
  label: string;
  description?: string;
  category?: string;
  shortcut?: string;
  execute: () => void | Promise<void>;
}

export class CommandPalette {
  private readonly commands = new Map<string, Command>();
  private query = '';

  register(command: Command): void {
    if (this.commands.has(command.id)) throw new Error(`Command already registered: ${command.id}`);
    this.commands.set(command.id, command);
  }

  unregister(id: string): boolean {
    return this.commands.delete(id);
  }

  setQuery(query: string): void {
    this.query = query.toLowerCase();
  }

  search(): Command[] {
    if (!this.query) return [...this.commands.values()];
    return [...this.commands.values()].filter(
      c =>
        c.label.toLowerCase().includes(this.query) ||
        (c.description ?? '').toLowerCase().includes(this.query),
    );
  }

  async execute(id: string): Promise<void> {
    const cmd = this.commands.get(id);
    if (!cmd) throw new Error(`Command not found: ${id}`);
    await cmd.execute();
  }

  list(): Command[] {
    return [...this.commands.values()];
  }
}
