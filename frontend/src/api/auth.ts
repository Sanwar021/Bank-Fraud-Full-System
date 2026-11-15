import api from './client';

export interface User {
  id: string;
  email: string;
  role_id: 'CUSTOMER' | 'TELLER' | 'FRAUD_ANALYST' | 'ADMIN';
  is_active: boolean;
  failed_login_attempts: number;
  locked_until?: string;
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    national_id: string;
    kyc_status: string;
    risk_tier: string;
    address: string;
    monthly_income: string;
  };
}

export interface LoginResponse {
  user: User;
  token_pair: {
    access_token: string;
    refresh_token: string;
    expires_at: string;
    token_type: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  national_id: string;
  address?: string;
  monthly_income?: number;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },

  register: async (data: RegisterRequest) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },

  getMe: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  getSessions: async () => {
    const res = await api.get('/auth/sessions');
    return res.data;
  },

  requestOTP: async (action: string) => {
    const res = await api.post('/auth/otp/request', { action_type: action });
    return res.data;
  },

  verifyOTP: async (action: string, code: string) => {
    const res = await api.post('/auth/otp/verify', { action_type: action, code });
    return res.data;
  },
};
