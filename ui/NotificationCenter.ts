export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  level: NotificationLevel;
  message: string;
  read: boolean;
  createdAt: string;
}

export class NotificationCenter {
  private readonly notifications: Notification[] = [];

  push(level: NotificationLevel, message: string): Notification {
    const n: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      level,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.push(n);
    return { ...n };
  }

  markRead(id: string): void {
    const n = this.notifications.find(x => x.id === id);
    if (!n) throw new Error(`Notification not found: ${id}`);
    n.read = true;
  }

  markAllRead(): void {
    for (const n of this.notifications) n.read = true;
  }

  unread(): Notification[] {
    return this.notifications.filter(n => !n.read).map(n => ({ ...n }));
  }

  list(): Notification[] {
    return [...this.notifications].map(n => ({ ...n }));
  }

  clear(): void {
    this.notifications.length = 0;
  }
}
