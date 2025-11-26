import api from './api';
import { Broadcast } from '../types';

export const broadcastService = {
  async getAll(): Promise<Broadcast[]> {
    const response = await api.get('/broadcasts');
    // Handle paginated response from backend
    return response.data.broadcasts || response.data;
  },

  async getById(id: string): Promise<Broadcast> {
    const response = await api.get(`/broadcasts/${id}`);
    return response.data;
  },

  async create(data: Partial<Broadcast>): Promise<Broadcast> {
    const response = await api.post('/broadcasts', data);
    return response.data;
  },

  async update(id: string, data: Partial<Broadcast>): Promise<Broadcast> {
    const response = await api.patch(`/broadcasts/${id}`, data);
    return response.data;
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
    const response = await api.post(`/broadcasts/${id}/start`, requestBody);
    return response.data;
  },

  async end(id: string): Promise<Broadcast> {
    const response = await api.post(`/broadcasts/${id}/end`);
    return response.data;
  },

  async getStats(id: string): Promise<any> {
    const response = await api.get(`/broadcasts/${id}/stats`);
    return response.data;
  },
};
