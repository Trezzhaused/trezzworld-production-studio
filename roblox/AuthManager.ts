export interface AuthSession {
  authenticated: boolean;
  userId?: string;
  accessToken?: string;
  expiresAt?: string;
}

export class AuthManager {
  private session: AuthSession = { authenticated: false };

  login(userId: string, accessToken: string, expiresAt?: string): AuthSession {
    this.session = {
      authenticated: true,
      userId,
      accessToken,
      expiresAt,
    };
    return { ...this.session };
  }

  logout(): void {
    this.session = { authenticated: false };
  }

  isAuthenticated(): boolean {
    return this.session.authenticated;
  }

  getSession(): AuthSession {
    return { ...this.session };
  }
}
