export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: unknown;
}

export class Logger {
  private readonly entries: LogEntry[] = [];

  log(level: LogLevel, message: string, context?: unknown): void {
    this.entries.push({
      timestamp: new Date(),
      level,
      message,
      context,
    });
  }

  debug(message: string, context?: unknown): void { this.log('debug', message, context); }
  info(message: string, context?: unknown): void { this.log('info', message, context); }
  warn(message: string, context?: unknown): void { this.log('warn', message, context); }
  error(message: string, context?: unknown): void { this.log('error', message, context); }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries.length = 0;
  }
}
