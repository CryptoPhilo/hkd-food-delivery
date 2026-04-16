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
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isSystemAdmin: boolean;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // [SECURITY] H-1: httpOnly 쿠키 기반 — /me 호출로 세션 복원
    const restoreSession = async () => {
      try {
        const res = await fetch('/api/v1/admin/auth/me', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setAdmin(data.data);
          }
        }
      } catch {
        // 세션 없음 — 무시
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/v1/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success) {
        setAdmin(data.data.admin);
        return { success: true };
      }
      return { success: false, error: data.error || '로그인 실패' };
    } catch {
      return { success: false, error: '서버 연결에 실패했습니다' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/v1/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // best-effort
    }
    setAdmin(null);
  };

  // [SECURITY] H-1: httpOnly 쿠키 자동 전송 — credentials: 'include' 사용
  const adminFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      credentials: 'include',
    });
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        login,
        logout,
        isSystemAdmin: admin?.role === 'system_admin',
        adminFetch,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return context;
}
