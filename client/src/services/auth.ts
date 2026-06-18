import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserPublic,
  UpdateUserRequest,
} from '../types';

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
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });
  return res.json() as Promise<ApiResponse<T>>;
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
  update: (id: string, data: UpdateUserRequest) =>
    authRequest<UserPublic>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    authRequest(`/users/${id}`, { method: 'DELETE' }),
};
