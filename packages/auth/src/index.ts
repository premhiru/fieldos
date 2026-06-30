export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  user: AuthenticatedUser;
  expiresAt: Date;
}

export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  requireSession(): Promise<AuthSession>;
}
