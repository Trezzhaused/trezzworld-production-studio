export type UserStatus = 'online' | 'away' | 'offline';

export interface UserModel {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  status: UserStatus;
  joinedAt: string;
  metadata?: Record<string, unknown>;
}

export class User {
  constructor(private model: UserModel) {}

  getId(): string { return this.model.id; }
  getUsername(): string { return this.model.username; }
  getStatus(): UserStatus { return this.model.status; }

  setStatus(status: UserStatus): void { this.model.status = status; }

  update(fields: Partial<Pick<UserModel, 'displayName' | 'email' | 'avatarUrl' | 'metadata'>>): void {
    Object.assign(this.model, fields);
  }

  getModel(): UserModel { return { ...this.model }; }

  static create(username: string, displayName?: string): User {
    return new User({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      username, displayName,
      status: 'offline',
      joinedAt: new Date().toISOString(),
    });
  }
}
