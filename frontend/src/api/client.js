import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
});

const SESSION_KEY = 'firis-session';

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('firis-session-change'));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event('firis-session-change'));
}

apiClient.interceptors.request.use((config) => {
  const token = getSession()?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(undefined, (error) => {
  if (error.response?.status === 401 && !error.config?.url?.includes('/api/auth/login')) {
    clearSession();
  }
  return Promise.reject(error);
});

export function apiError(error) {
  return error.response?.data?.message || error.message || '서버 요청에 실패했습니다.';
}

export async function fetchMedia(path, signal) {
  const response = await apiClient.get(path, { responseType: 'blob', signal });
  return URL.createObjectURL(response.data);
}
