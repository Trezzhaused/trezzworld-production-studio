export type AuditAction =
  | 'login' | 'logout' | 'access' | 'create' | 'update' | 'delete'
  | 'publish' | 'deploy' | 'permission_change' | 'role_change' | 'other';

export interface AuditEntry {
  id: string;
  userId: string;
  action: AuditAction;
  resource?: string;
  details?: Record<string, unknown>;
  timestamp: string;
  success: boolean;
}

export class AuditLog {
  private readonly entries: AuditEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 10_000) { this.maxEntries = maxEntries; }

  log(
    userId: string,
    action: AuditAction,
    options: { resource?: string; details?: Record<string, unknown>; success?: boolean } = {},
  ): AuditEntry {
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId, action,
      resource: options.resource,
      details: options.details,
      success: options.success ?? true,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.shift();
    return { ...entry };
  }

  query(options: { userId?: string; action?: AuditAction; since?: string; limit?: number } = {}): AuditEntry[] {
    let results = [...this.entries];
    if (options.userId) results = results.filter(e => e.userId === options.userId);
    if (options.action) results = results.filter(e => e.action === options.action);
    if (options.since) results = results.filter(e => e.timestamp >= options.since!);
    if (options.limit) results = results.slice(-options.limit);
    return results;
  }

  clear(): void { this.entries.length = 0; }
}
