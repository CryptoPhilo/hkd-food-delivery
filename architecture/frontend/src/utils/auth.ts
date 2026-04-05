/**
 * JWT 인증 유틸리티
 * - Access Token: 메모리 관리 (XSS 방어)
 * - Refresh Token: httpOnly 쿠키 (JS 접근 불가, 서버가 자동 관리)
 * - 자동 토큰 갱신이 포함된 fetchWithAuth
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Access Token은 메모리에만 저장 (XSS 방어)
let accessToken: string | null = null;

// ============================================
// Token 관리
// ============================================

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * 전화번호 인증 완료 후 토큰 저장
 * - Access Token만 메모리에 저장
 * - Refresh Token은 서버가 httpOnly 쿠키로 설정하므로 별도 처리 불필요
 */
export function saveAuthTokens(tokens: { access_token: string }): void {
  setAccessToken(tokens.access_token);
}

/**
 * 로그아웃 — 서버에 Refresh Token 무효화 요청 (쿠키 자동 전송)
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // httpOnly 쿠키 전송
    });
  } catch {
    // 서버 요청 실패해도 로컬 토큰은 정리
  }

  setAccessToken(null);
}

/**
 * 인증 여부 확인
 * - Access Token이 메모리에 있으면 인증됨
 * - 없더라도 세션 복원으로 쿠키에서 갱신 가능
 */
export function isAuthenticated(): boolean {
  return !!accessToken;
}

// ============================================
// Token 갱신
// ============================================

let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh Token(httpOnly 쿠키)으로 새 Access Token 발급
 * 동시 여러 호출이 오더라도 한 번만 실행 (중복 방지)
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // httpOnly 쿠키 자동 전송
      });

      if (!response.ok) {
        setAccessToken(null);
        return null;
      }

      const data = await response.json();
      if (data.success && data.access_token) {
        setAccessToken(data.access_token);
        return data.access_token;
      }

      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ============================================
// 인증이 포함된 fetch
// ============================================

/**
 * Authorization 헤더가 자동으로 포함되는 fetch 래퍼
 * - Access Token 만료 시 자동으로 Refresh → 재시도
 * - Refresh도 실패하면 인증 없이 응답 반환 (호출부에서 재인증 유도)
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // 1. Access Token이 없으면 먼저 갱신 시도
  if (!accessToken) {
    await refreshAccessToken();
  }

  // 2. 요청 생성
  const makeRequest = (token: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers, credentials: 'include' });
  };

  let response = await makeRequest(accessToken);

  // 3. 401이면 토큰 갱신 후 재시도
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await makeRequest(newToken);
    }
  }

  return response;
}

// ============================================
// 페이지 로드 시 세션 복원
// ============================================

/**
 * 앱 초기화 시 호출 — httpOnly 쿠키의 Refresh Token으로 Access Token 재발급
 */
export async function restoreSession(): Promise<boolean> {
  const newToken = await refreshAccessToken();
  return !!newToken;
}
