/**
 * School Safe Connect - Web API Client
 * Automatically manages JWT access tokens, 2FA challenges, and tenant isolation headers.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  timestamp: string;
}

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ssc_access_token');
};

export const setStoredToken = (token: string, refreshToken?: string, userProfile?: any): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ssc_access_token', token);
    if (refreshToken) {
      localStorage.setItem('ssc_refresh_token', refreshToken);
    }
    if (userProfile) {
      localStorage.setItem('ssc_user_profile', JSON.stringify(userProfile));
    }
  }
};

export const clearStoredSession = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ssc_access_token');
    localStorage.removeItem('ssc_refresh_token');
    localStorage.removeItem('ssc_user_profile');
  }
};

export const getStoredUser = (): any | null => {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('ssc_user_profile');
  return user ? JSON.parse(user) : null;
};

export const apiClient = async <T = any>(
  endpoint: string,
  options: RequestInit = {},
  superAdminTenant?: { schoolCode: string; reason: string },
  isRetry: boolean = false
): Promise<ApiResponse<T>> => {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Type': 'WEB', // Strictly identify Web Dashboard requests
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (superAdminTenant) {
    headers['X-School-Code'] = superAdminTenant.schoolCode;
    headers['X-Super-Admin-Reason'] = superAdminTenant.reason;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (response.status === 401 && !isRetry && endpoint !== '/auth/refresh-token' && endpoint !== '/auth/login' && endpoint !== '/auth/verify-2fa') {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('ssc_refresh_token') : null;
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'WEB' },
          body: JSON.stringify({ refreshToken })
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.data?.accessToken) {
          setStoredToken(refreshData.data.accessToken, refreshData.data.refreshToken);
          return apiClient<T>(endpoint, options, superAdminTenant, true);
        }
      } catch (e) {
        // Refresh failed, proceed to handle original 401
      }
    }
  }

  if (!response.ok) {
    let detail: string | null = null;
    if (Array.isArray(data.error)) {
      detail = data.error.join(', ');
    } else if (typeof data.error === 'string') {
      detail = data.error;
    } else if (data.error && typeof data.error === 'object') {
      detail = Object.values(data.error).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
    }
    const fullMsg = detail ? `${data.message}: ${detail}` : (data.message || `API Error: ${response.status}`);
    throw new Error(fullMsg);
  }

  return data;
};
