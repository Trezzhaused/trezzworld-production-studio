export type ShutdownHook = () => Promise<void>;

export class ShutdownManager {
  private readonly hooks: Array<{ name: string; hook: ShutdownHook }> = [];
  private shuttingDown = false;

  register(name: string, hook: ShutdownHook): void {
    this.hooks.push({ name, hook });
  }

  async shutdown(timeoutMs = 10_000): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    const deadline = Date.now() + timeoutMs;
    for (const { name, hook } of [...this.hooks].reverse()) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      try {
        await Promise.race([
          hook(),
          new Promise<void>((_, rej) => setTimeout(() => rej(new Error(`Timeout: ${name}`)), remaining)),
        ]);
      } catch {
        // continue shutdown even if a hook fails or times out
      }
    }
    this.shuttingDown = false;
  }

  isShuttingDown(): boolean { return this.shuttingDown; }

  list(): string[] { return this.hooks.map(h => h.name); }
}
