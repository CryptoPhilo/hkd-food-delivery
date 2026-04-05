'use client';

/**
 * 고객 인증 Context
 * - 전화번호 인증 → JWT 토큰 관리
 * - Access Token: 메모리 보관
 * - Refresh Token: httpOnly 쿠키 (서버 관리, JS 접근 불가)
 * - 앱 로드 시 세션 자동 복원
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  getAccessToken,
  setAccessToken,
  saveAuthTokens,
  logout as authLogout,
  restoreSession,
  isAuthenticated as checkAuth,
  fetchWithAuth,
} from '@/utils/auth';

interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** 전화번호 인증 완료 후 호출 — 서버 응답의 토큰/유저 정보 저장 */
  onPhoneVerified: (data: {
    access_token: string;
    user: AuthUser;
  }) => void;
  /** 로그아웃 */
  logout: () => Promise<void>;
  /** 인증이 포함된 fetch */
  fetchWithAuth: typeof fetchWithAuth;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 앱 로드 시 세션 복원
  useEffect(() => {
    const init = async () => {
      try {
        // localStorage에 저장된 유저 정보 복원
        const savedUser = localStorage.getItem('hkd_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }

        // httpOnly 쿠키의 Refresh Token으로 Access Token 재발급 시도
        const restored = await restoreSession();
        if (!restored) {
          // 복원 실패 시 저장된 유저 정보도 정리
          setUser(null);
          localStorage.removeItem('hkd_user');
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const onPhoneVerified = useCallback((data: {
    access_token: string;
    user: AuthUser;
  }) => {
    // Access Token만 메모리에 저장 (Refresh Token은 서버가 쿠키로 설정)
    saveAuthTokens({ access_token: data.access_token });
    setUser(data.user);
    localStorage.setItem('hkd_user', JSON.stringify(data.user));
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
    localStorage.removeItem('hkd_user');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && checkAuth(),
        loading,
        onPhoneVerified,
        logout,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
