export type AuthStatus = 'authenticated' | 'unauthenticated' | 'locked';

export interface AuthSession {
  userId: string;
  token: string;
  createdAt: string;
  expiresAt?: string;
}

export class AuthManager {
  private readonly sessions = new Map<string, AuthSession>();
  private readonly lockedUsers = new Set<string>();

  createSession(userId: string, token: string, expiresAt?: string): AuthSession {
    const session: AuthSession = { userId, token, createdAt: new Date().toISOString(), expiresAt };
    this.sessions.set(token, session);
    return { ...session };
  }

  validateToken(token: string): AuthSession {
    const session = this.sessions.get(token);
    if (!session) throw new Error('Invalid token');
    if (this.lockedUsers.has(session.userId)) throw new Error(`User is locked: ${session.userId}`);
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      throw new Error('Token expired');
    }
    return { ...session };
  }

  revokeToken(token: string): boolean { return this.sessions.delete(token); }

  revokeAllForUser(userId: string): number {
    let count = 0;
    for (const [token, session] of this.sessions) {
      if (session.userId === userId) { this.sessions.delete(token); count++; }
    }
    return count;
  }

  lockUser(userId: string): void { this.lockedUsers.add(userId); }
  unlockUser(userId: string): void { this.lockedUsers.delete(userId); }
  isLocked(userId: string): boolean { return this.lockedUsers.has(userId); }

  getStatus(userId: string): AuthStatus {
    if (this.lockedUsers.has(userId)) return 'locked';
    for (const session of this.sessions.values()) {
      if (session.userId === userId) return 'authenticated';
    }
    return 'unauthenticated';
  }
}
