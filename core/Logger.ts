export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  source: string;
  message: string;
  timestamp: string;
  data?: unknown;
}

export class Logger {
  private readonly entries: LogEntry[] = [];
  private minLevel: LogLevel = 'info';

  private readonly levelOrder: Record<LogLevel, number> = {
    debug: 0, info: 1, warn: 2, error: 3,
  };

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  debug(source: string, message: string, data?: unknown): void {
    this.log('debug', source, message, data);
  }

  info(source: string, message: string, data?: unknown): void {
    this.log('info', source, message, data);
  }

  warn(source: string, message: string, data?: unknown): void {
    this.log('warn', source, message, data);
  }

  error(source: string, message: string, data?: unknown): void {
    this.log('error', source, message, data);
  }

  getEntries(level?: LogLevel): LogEntry[] {
    if (!level) return [...this.entries];
    return this.entries.filter(e => this.levelOrder[e.level] >= this.levelOrder[level]);
  }

  clear(): void {
    this.entries.length = 0;
  }

  private log(level: LogLevel, source: string, message: string, data?: unknown): void {
    if (this.levelOrder[level] < this.levelOrder[this.minLevel]) return;
    const entry: LogEntry = { level, source, message, timestamp: new Date().toISOString(), data };
    this.entries.push(entry);
  }
}
