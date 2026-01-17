/**
 * Authentication Service
 * Handles authentication operations and persistent storage
 */

import { User } from '../types';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

class AuthService {
  private token: string | null = null;
  private user: User | null = null;

  constructor() {
    // Load from localStorage on init
    this.token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    this.user = userJson ? JSON.parse(userJson) : null;
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return !!this.token && !!this.user;
  }

  setAuth(user: User, token?: string): void {
    this.user = user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    if (token) {
      this.token = token;
      localStorage.setItem(TOKEN_KEY, token);
    }
  }

  clearAuth(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    this.setAuth(data.user, data.token);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      // Ignore logout errors
    }
    this.clearAuth();
  }

  async getMe(): Promise<User> {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });

    if (!response.ok) {
      this.clearAuth();
      throw new Error('Not authenticated');
    }

    const user = await response.json();
    this.user = user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }
}

export const authService = new AuthService();
