export interface HistoryEntry {
  id: string;
  description: string;
  state: string;
  createdAt: string;
}

export class HistoryManager {
  private readonly history: HistoryEntry[] = [];
  private cursor = -1;

  push(description: string, state: unknown): HistoryEntry {
    // Truncate redo history when a new entry is added
    this.history.splice(this.cursor + 1);
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description,
      state: JSON.stringify(state),
      createdAt: new Date().toISOString(),
    };
    this.history.push(entry);
    this.cursor = this.history.length - 1;
    return { ...entry };
  }

  undo<T>(): T | undefined {
    if (this.cursor <= 0) return undefined;
    this.cursor--;
    return JSON.parse(this.history[this.cursor].state) as T;
  }

  redo<T>(): T | undefined {
    if (this.cursor >= this.history.length - 1) return undefined;
    this.cursor++;
    return JSON.parse(this.history[this.cursor].state) as T;
  }

  canUndo(): boolean {
    return this.cursor > 0;
  }

  canRedo(): boolean {
    return this.cursor < this.history.length - 1;
  }

  list(): HistoryEntry[] {
    return [...this.history].map(h => ({ ...h }));
  }

  clear(): void {
    this.history.length = 0;
    this.cursor = -1;
  }
}
