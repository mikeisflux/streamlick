import api, { fetchCsrfToken } from './api';
import { User } from '../types';

export const authService = {
  /**
   * Login with email and password
   * Tokens are stored in httpOnly cookies for XSS protection
   */
  async login(email: string, password: string): Promise<{ user: User }> {
    const response = await api.post('/auth/login', { email, password });
    // Fetch CSRF token after successful login
    await fetchCsrfToken();
    return response.data;
  },

  /**
   * Register new user
   * Tokens are stored in httpOnly cookies for XSS protection
   */
  async register(email: string, password: string, name?: string): Promise<{ user: User; message: string }> {
    const response = await api.post('/auth/register', { email, password, name });
    // Fetch CSRF token after successful registration
    await fetchCsrfToken();
    return response.data;
  },

  /**
   * Get current authenticated user
   */
  async getMe(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Logout - clears server-side cookies
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors - we still want to clear local state
      console.error('Logout error:', error);
    }
    // Clear any cached user data
    localStorage.removeItem('user');
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ user: User }> {
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  },

  /**
   * Resend verification email
   */
  async resendVerification(email: string): Promise<void> {
    await api.post('/auth/resend-verification', { email });
  },

  /**
   * Store user data in localStorage (tokens are in httpOnly cookies)
   */
  setAuth(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
  },

  /**
   * Get cached user data from localStorage
   */
  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Check if user is authenticated
   * Note: This checks cached user data. For server-side check, call getMe()
   */
  isAuthenticated(): boolean {
    return !!this.getUser();
  },

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    const user = this.getUser();
    return user?.role === 'admin';
  },
};
