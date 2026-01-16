import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '';

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Auth
export const authAPI = {
  login: (email: string, password: string) =>
    fetchAPI<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string) =>
    fetchAPI<{ user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  logout: () => fetchAPI('/api/auth/logout', { method: 'POST' }),

  me: () => fetchAPI<any>('/api/auth/me'),
};

// Broadcasts
export const broadcastAPI = {
  list: () => fetchAPI<any[]>('/api/broadcasts'),

  get: (id: string) => fetchAPI<any>(`/api/broadcasts/${id}`),

  create: (data: { title: string; description?: string }) =>
    fetchAPI<any>('/api/broadcasts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    fetchAPI<any>(`/api/broadcasts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI<void>(`/api/broadcasts/${id}`, { method: 'DELETE' }),

  start: (id: string) =>
    fetchAPI<any>(`/api/broadcasts/${id}/start`, { method: 'POST' }),

  goLive: (id: string) =>
    fetchAPI<any>(`/api/broadcasts/${id}/go-live`, { method: 'POST' }),

  end: (id: string) =>
    fetchAPI<any>(`/api/broadcasts/${id}/end`, { method: 'POST' }),

  invite: (id: string, data: { name: string; email?: string }) =>
    fetchAPI<{ participant: any; inviteUrl: string }>(`/api/broadcasts/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addDestination: (id: string, destinationId: string) =>
    fetchAPI<any>(`/api/broadcasts/${id}/destinations`, {
      method: 'POST',
      body: JSON.stringify({ destinationId }),
    }),
};

// Participants
export const participantAPI = {
  getByToken: (token: string) => fetchAPI<any>(`/api/participants/join/${token}`),

  join: (token: string, name?: string) =>
    fetchAPI<any>(`/api/participants/join/${token}`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  update: (id: string, data: any) =>
    fetchAPI<any>(`/api/participants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  bringOnStage: (id: string) =>
    fetchAPI<any>(`/api/participants/${id}/bring-on-stage`, { method: 'POST' }),

  removeFromStage: (id: string) =>
    fetchAPI<any>(`/api/participants/${id}/remove-from-stage`, { method: 'POST' }),

  remove: (id: string) =>
    fetchAPI<void>(`/api/participants/${id}`, { method: 'DELETE' }),
};

// Destinations
export const destinationAPI = {
  list: () => fetchAPI<any[]>('/api/destinations'),

  get: (id: string) => fetchAPI<any>(`/api/destinations/${id}`),

  create: (data: { name: string; platform: string; rtmpUrl: string; streamKey: string }) =>
    fetchAPI<any>('/api/destinations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    fetchAPI<any>(`/api/destinations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI<void>(`/api/destinations/${id}`, { method: 'DELETE' }),
};

// Compositor
export const compositorAPI = {
  setLayout: (broadcastId: string, layout: string) =>
    fetchAPI<any>(`/api/compositor/${broadcastId}/layout`, {
      method: 'POST',
      body: JSON.stringify({ layout }),
    }),

  setBranding: (broadcastId: string, data: any) =>
    fetchAPI<any>(`/api/compositor/${broadcastId}/branding`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reorder: (broadcastId: string, participantIds: string[]) =>
    fetchAPI<any>(`/api/compositor/${broadcastId}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ participantIds }),
    }),

  getState: (broadcastId: string) =>
    fetchAPI<any>(`/api/compositor/${broadcastId}/state`),
};
