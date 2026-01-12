import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
});

// CSRF token storage
let csrfToken: string | null = null;

/**
 * Fetch CSRF token from server
 * Called on app initialization and after login
 */
export async function fetchCsrfToken(): Promise<void> {
  try {
    const response = await api.get('/auth/csrf-token');
    csrfToken = response.data.csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }
}

/**
 * Get current CSRF token
 */
export function getCsrfToken(): string | null {
  return csrfToken;
}

// Add CSRF token to state-changing requests
api.interceptors.request.use((config) => {
  // Add CSRF token to POST, PUT, PATCH, DELETE requests
  if (csrfToken && config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }

  // Debug logging for broadcast start requests
  if (config.url?.includes('/broadcasts/') && config.url?.includes('/start')) {
    console.log('[API Interceptor] Broadcast start request:', {
      url: config.url,
      method: config.method,
      data: config.data,
      dataStringified: JSON.stringify(config.data),
      headers: config.headers,
      contentType: config.headers['Content-Type'],
    });
  }

  return config;
});

// Track if we're currently refreshing to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Handle auth and CSRF errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle CSRF token missing/invalid - fetch new token and retry
    if (error.response?.status === 403 && error.response?.data?.error?.includes('CSRF')) {
      try {
        await fetchCsrfToken();
        // Retry the original request with new CSRF token
        if (csrfToken) {
          originalRequest.headers['X-CSRF-Token'] = csrfToken;
          return api.request(originalRequest);
        }
      } catch (retryError) {
        console.error('Failed to retry after CSRF token refresh:', retryError);
      }
    }

    // Handle 401 auth errors - try to refresh token first
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh on login/logout pages or if already on refresh endpoint
      if (window.location.pathname === '/login' ||
          window.location.pathname === '/' ||
          originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      // If already refreshing, queue the request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api.request(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the access token
        await api.post('/auth/refresh');

        // Refresh successful, retry original request
        processQueue(null);
        isRefreshing = false;

        // Also refresh CSRF token after token refresh
        await fetchCsrfToken();
        if (csrfToken) {
          originalRequest.headers['X-CSRF-Token'] = csrfToken;
        }

        return api.request(originalRequest);
      } catch (refreshError) {
        // Refresh failed - redirect to login
        processQueue(refreshError);
        isRefreshing = false;

        // Store intended destination before redirecting
        const intendedPath = window.location.pathname + window.location.search;
        if (intendedPath !== '/login') {
          localStorage.setItem('redirectAfterLogin', intendedPath);
        }

        // Clear any auth-related localStorage and redirect
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
