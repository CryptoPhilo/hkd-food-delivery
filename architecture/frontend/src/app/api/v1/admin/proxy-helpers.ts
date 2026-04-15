/**
 * Admin API 프록시 헬퍼
 * - Next.js API Route에서 백엔드로 프록시할 때 사용
 * - 관리자 인증 헤더 자동 전달
 */

export const BACKEND_URL = process.env.BACKEND_URL || 'https://hkd-backend.fly.dev';

/**
 * 요청에서 관리자 인증 헤더를 추출하여 백엔드용 헤더로 변환
 * [SECURITY] X-Admin-Key 정적 키 방식 제거 (CRITICAL-07)
 */
export function getAdminHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // [SECURITY] H-1: httpOnly 쿠키에서 admin_token 추출하여 백엔드에 전달
  const cookieHeader = request.headers.get('cookie') || '';
  const adminTokenMatch = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]*)/);
  const adminTokenFromCookie = adminTokenMatch ? adminTokenMatch[1] : null;

  // 쿠키 우선, 헤더 폴백 (마이그레이션 기간)
  const adminToken = adminTokenFromCookie || request.headers.get('x-admin-token');
  if (adminToken) headers['X-Admin-Token'] = adminToken;

  return headers;
}
