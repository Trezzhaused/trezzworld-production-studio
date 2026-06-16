export interface RemoteCommand {
  id: string;
  name: string;
  args: unknown[];
  sentAt: string;
}

export interface RemoteResult {
  commandId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  executedAt: string;
}

export class RemoteExecutor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly handlers = new Map<string, (...args: any[]) => Promise<unknown>>();
  private readonly results: RemoteResult[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(name: string, handler: (...args: any[]) => Promise<unknown>): void {
    if (this.handlers.has(name)) throw new Error(`Handler already registered: ${name}`);
    this.handlers.set(name, handler);
  }

  async execute(name: string, ...args: unknown[]): Promise<RemoteResult> {
    const commandId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const handler = this.handlers.get(name);
    if (!handler) {
      const result: RemoteResult = { commandId, success: false, error: `Handler not found: ${name}`, executedAt: new Date().toISOString() };
      this.results.push(result);
      return result;
    }
    try {
      const output = await handler(...args);
      const result: RemoteResult = { commandId, success: true, output, executedAt: new Date().toISOString() };
      this.results.push(result);
      return result;
    } catch (err) {
      const result: RemoteResult = { commandId, success: false, error: String(err), executedAt: new Date().toISOString() };
      this.results.push(result);
      return result;
    }
  }

  history(): RemoteResult[] {
    return [...this.results];
  }
}
