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
  return config;
});

// Handle auth and CSRF errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle CSRF token missing/invalid - fetch new token and retry
    if (error.response?.status === 403 && error.response?.data?.error?.includes('CSRF')) {
      try {
        await fetchCsrfToken();
        // Retry the original request with new CSRF token
        const originalRequest = error.config;
        if (csrfToken) {
          originalRequest.headers['X-CSRF-Token'] = csrfToken;
          return api.request(originalRequest);
        }
      } catch (retryError) {
        console.error('Failed to retry after CSRF token refresh:', retryError);
      }
    }

    // Handle auth errors
    if (error.response?.status === 401 && window.location.pathname !== '/' && window.location.pathname !== '/login') {
      // Store intended destination before redirecting
      const intendedPath = window.location.pathname + window.location.search;
      if (intendedPath !== '/login') {
        localStorage.setItem('redirectAfterLogin', intendedPath);
      }

      // Clear any auth-related localStorage and redirect
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
