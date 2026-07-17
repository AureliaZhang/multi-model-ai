import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  CreateUserRequest,
  UserPublic,
  UpdateUserRequest,
} from '../types';
import { getErrorMessage } from '../utils/errors';

const BASE_URL = '/api';

export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

export function removeToken(): void {
  localStorage.removeItem('auth_token');
}

async function authRequest<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = `${BASE_URL}${url}`;
  let res: Response;
  try {
    res = await fetch(fullUrl, { ...options, headers });
  } catch (fetchErr: unknown) {
    console.error(`[authRequest] Fetch failed for ${fullUrl}:`, getErrorMessage(fetchErr));
    return { success: false, error: `Network error: ${getErrorMessage(fetchErr)}` } as ApiResponse<T>;
  }

  try {
    const data = await res.json();
    return data as ApiResponse<T>;
  } catch (jsonErr: unknown) {
    console.error(`[authRequest] JSON parse failed for ${fullUrl} (status ${res.status}):`, getErrorMessage(jsonErr));
    return { success: false, error: `Invalid response from server (HTTP ${res.status})` } as ApiResponse<T>;
  }
}

// --- Auth API ---
export const authApi = {
  register: (data: RegisterRequest) =>
    authRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginRequest) =>
    authRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => authRequest<UserPublic>('/auth/me'),
};

// --- User Management API (admin) ---
export const userApi = {
  list: () => authRequest<UserPublic[]>('/users'),
  get: (id: string) => authRequest<UserPublic>(`/users/${id}`),
  create: (data: CreateUserRequest) =>
    authRequest<UserPublic>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateUserRequest) =>
    authRequest<UserPublic>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    authRequest(`/users/${id}`, { method: 'DELETE' }),
};
