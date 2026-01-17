import api from './api';
import { Broadcast } from '../types';

// Note: api.get/post/patch/delete return JSON data directly, not axios-style response objects

export const broadcastService = {
  async getAll(): Promise<Broadcast[]> {
    const data = await api.get<any>('/broadcasts');
    // Handle paginated response from backend
    return data.broadcasts || data;
  },

  async getById(id: string): Promise<Broadcast> {
    return api.get<Broadcast>(`/broadcasts/${id}`);
  },

  async create(data: Partial<Broadcast>): Promise<Broadcast> {
    return api.post<Broadcast>('/broadcasts', data);
  },

  async update(id: string, data: Partial<Broadcast>): Promise<Broadcast> {
    return api.patch<Broadcast>(`/broadcasts/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/broadcasts/${id}`);
  },

  async start(
    id: string,
    destinationIds?: string[],
    destinationSettings?: Record<string, { privacyStatus?: string; scheduledStartTime?: string }>
  ): Promise<Broadcast> {
    const requestBody = {
      destinationIds,
      destinationSettings,
    };
    return api.post<Broadcast>(`/broadcasts/${id}/start`, requestBody);
  },

  async end(id: string): Promise<Broadcast> {
    return api.post<Broadcast>(`/broadcasts/${id}/end`);
  },

  async getStats(id: string): Promise<any> {
    return api.get<any>(`/broadcasts/${id}/stats`);
  },
};
