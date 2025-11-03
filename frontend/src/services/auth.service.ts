import api from './api';
import { User } from '../types';

export const authService = {
  async sendMagicLink(email: string): Promise<void> {
    await api.post('/auth/send-magic-link', { email });
  },

  async verifyToken(token: string): Promise<{ user: User; accessToken: string }> {
    const response = await api.post('/auth/verify-token', { token });
    return response.data;
  },

  async getMe(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  },

  setAuth(accessToken: string, user: User): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  },
};
