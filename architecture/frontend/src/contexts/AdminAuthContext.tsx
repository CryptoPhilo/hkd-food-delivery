'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: 'system_admin' | 'region_admin';
  regionId: string | null;
  regionName: string | null;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isSystemAdmin: boolean;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 저장된 토큰으로 세션 복원
    const savedToken = sessionStorage.getItem('adminToken');
    const savedAdmin = sessionStorage.getItem('adminUser');
    if (savedToken && savedAdmin) {
      try {
        setToken(savedToken);
        setAdmin(JSON.parse(savedAdmin));
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/v1/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success) {
        setToken(data.data.token);
        setAdmin(data.data.admin);
        sessionStorage.setItem('adminToken', data.data.token);
        sessionStorage.setItem('adminUser', JSON.stringify(data.data.admin));
        return { success: true };
      }
      return { success: false, error: data.error || '로그인 실패' };
    } catch {
      return { success: false, error: '서버 연결에 실패했습니다' };
    }
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
  };

  // 어드민 API 호출 시 자동으로 토큰을 포함하는 fetch 헬퍼
  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers['X-Admin-Token'] = token;
    }
    if (admin) {
      const adminUserJson = JSON.stringify({
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
        regionId: admin.regionId,
      });
      headers['X-Admin-User'] = btoa(unescape(encodeURIComponent(adminUserJson)));
    }
    return fetch(url, { ...options, headers });
  };

  return (
    <AdminAuthContext.Provider value={{
      admin,
      token,
      loading,
      login,
      logout,
      isSystemAdmin: admin?.role === 'system_admin',
      adminFetch,
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return context;
}
