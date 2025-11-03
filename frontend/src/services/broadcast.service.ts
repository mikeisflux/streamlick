import api from './api';
import { Broadcast } from '../types';

export const broadcastService = {
  async getAll(): Promise<Broadcast[]> {
    const response = await api.get('/broadcasts');
    return response.data;
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

  async start(id: string): Promise<Broadcast> {
    const response = await api.post(`/broadcasts/${id}/start`);
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
