/**
 * 보안 미들웨어 모음
 * - Rate Limiting (Redis 기반, 인메모리 폴백)
 * - Security Headers (Helmet 대체)
 * - Input Sanitization
 * - Request Size Limiting
 * - CORS 강화
 */
import { Request, Response, NextFunction } from 'express';
import { redisService as redis } from '../services/RedisService';
import logger from '../utils/logger';

// ============================================
// 1. Rate Limiting (Redis 기반)
// ============================================

/**
 * Redis 기반 Rate Limiter
 * Redis 연결 시: 분산 환경 지원 (다중 인스턴스 공유)
 * Redis 미연결: 인메모리 폴백 (기존 동작과 동일)
 */
async function checkRate(
  prefix: string,
  ip: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const key = `${prefix}:${ip}`;
  return redis.checkRateLimit(key, maxRequests, windowSeconds);
}

/**
 * API 요청 Rate Limiter
 * 기본: IP당 15분에 100회
 * 테스트 환경에서는 비활성화
 */
export const apiRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  // 테스트 환경에서는 rate limiting 스킵
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const ip = req.ip || req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  const result = await checkRate('api', ip, 500, 15 * 60);

  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

  if (!result.allowed) {
    return res.status(429).json({
      success: false,
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
    });
  }

  next();
};

/**
 * 인증 관련 Rate Limiter (더 엄격)
 * IP당 15분에 10회 (SMS 인증 등)
 */
export const authRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') return next();

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const result = await checkRate('auth', ip, 10, 15 * 60);

  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

  if (!result.allowed) {
    return res.status(429).json({
      success: false,
      error: '인증 요청이 너무 많습니다. 15분 후 다시 시도해주세요.',
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
    });
  }

  next();
};

/**
 * 주문 생성 Rate Limiter (CRITICAL-02 보안 취약점 수정)
 * IP당 1분에 5건, 전화번호 기반 추가 제한
 * 무인증 상태에서의 대량 가짜 주문 공격 방지
 */
export const orderCreateRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') return next();

  const ip = req.ip || req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';

  // IP 기반 제한: 분당 5건
  const ipResult = await checkRate('order_create_ip', ip, 5, 60);
  res.setHeader('X-RateLimit-Remaining', ipResult.remaining.toString());
  res.setHeader('X-RateLimit-Reset', new Date(ipResult.resetAt).toISOString());

  if (!ipResult.allowed) {
    logger.warn('[SECURITY] 주문 생성 rate limit 초과', { ip, type: 'ip' });
    return res.status(429).json({
      success: false,
      error: '주문 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryAfter: Math.ceil((ipResult.resetAt - Date.now()) / 1000),
    });
  }

  // 전화번호 기반 추가 제한: 시간당 10건
  const phone = req.body?.phone;
  if (phone) {
    const phoneResult = await checkRate('order_create_phone', phone, 10, 60 * 60);
    if (!phoneResult.allowed) {
      logger.warn('[SECURITY] 전화번호별 주문 생성 rate limit 초과', { phone: phone.substring(0, 5) + '****' });
      return res.status(429).json({
        success: false,
        error: '해당 전화번호로의 주문 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        retryAfter: Math.ceil((phoneResult.resetAt - Date.now()) / 1000),
      });
    }
  }

  next();
};

/**
 * 웹훅 Rate Limiter
 * IP당 1분에 30회
 */
export const webhookRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') return next();

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const result = await checkRate('webhook', ip, 30, 60);

  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

  if (!result.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many webhook requests',
    });
  }

  next();
};

// ============================================
// 2. Security Headers (Helmet 대체)
// ============================================
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // XSS 보호
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // HTTPS 강제 (프로덕션)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  // 참조자 정보 제한
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 서버 정보 숨기기
  res.removeHeader('X-Powered-By');

  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');

  next();
};

// ============================================
// 3. Input Sanitization
// ============================================

/**
 * XSS 방지를 위한 문자열 이스케이프
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * SQL Injection 패턴 감지
 */
function hasSqlInjection(str: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b)/i,
    /(--|#|\/\*|\*\/)/,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
    /(;\s*(DROP|DELETE|INSERT|UPDATE|ALTER))/i,
  ];

  return sqlPatterns.some(pattern => pattern.test(str));
}

/**
 * 재귀적으로 객체의 모든 문자열 값을 검사/정제
 */
function sanitizeValue(value: any, depth = 0): any {
  // 깊이 제한 (재귀 공격 방지)
  if (depth > 10) return value;

  if (typeof value === 'string') {
    // SQL Injection 패턴 감지 시 이스케이프 처리
    const sanitized = escapeHtml(value.trim());
    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[escapeHtml(key)] = sanitizeValue(val, depth + 1);
    }
    return sanitized;
  }

  return value;
}

/**
 * 입력값 검증 및 정제 미들웨어
 * 주의: 테스트 환경에서는 비활성화하여 validation 미들웨어가
 * 원본 입력값을 검증할 수 있도록 합니다.
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') return next();
  // Body 정제
  if (req.body && typeof req.body === 'object') {
    // SQL Injection 패턴 감지
    const bodyStr = JSON.stringify(req.body);
    if (hasSqlInjection(bodyStr)) {
      logger.warn('[SECURITY] SQL injection 패턴 감지', {
        ip: req.ip,
        path: req.path,
        body: bodyStr.substring(0, 200),
      });
      // 주의: Prisma ORM을 사용하므로 직접적인 SQL injection 위험은 낮지만
      // 로그 기록 및 모니터링 목적으로 감지
    }

    req.body = sanitizeValue(req.body);
  }

  // Query parameter 정제
  if (req.query) {
    const sanitizedQuery: Record<string, any> = {};
    for (const [key, val] of Object.entries(req.query)) {
      if (typeof val === 'string') {
        sanitizedQuery[key] = escapeHtml(val.trim());
      } else {
        sanitizedQuery[key] = val;
      }
    }
    req.query = sanitizedQuery;
  }

  next();
};

// ============================================
// 4. Request Size & Type Validation
// ============================================

/**
 * JSON 페이로드 크기 제한 (기본 1MB)
 */
export const requestSizeLimit = (maxSizeKB: number = 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSizeKB * 1024) {
      return res.status(413).json({
        success: false,
        error: `요청 크기가 최대 허용치(${maxSizeKB}KB)를 초과했습니다`,
      });
    }

    next();
  };
};

// ============================================
// 5. CORS 강화 설정
// ============================================

/**
 * 프로덕션 환경에서 사용할 CORS 옵션 생성
 */
export function getCorsOptions() {
  // [SECURITY] CORS 화이트리스트 적용 (CRITICAL-04)
  // 기본 허용 도메인 + 환경변수로 추가 도메인 설정 가능
  const DEFAULT_ORIGINS = ['https://hankyeong.xyz'];
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  const allowedOrigins = envOrigins.length > 0
    ? [...new Set([...DEFAULT_ORIGINS, ...envOrigins])]
    : DEFAULT_ORIGINS;

  // 개발 환경에서는 모든 origin 허용
  if (process.env.NODE_ENV !== 'production') {
    return {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-Admin-User', 'X-Request-ID'],
      maxAge: 600,
    };
  }

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // 서버-투-서버 요청 (origin이 없는 경우) 허용
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS 정책에 의해 차단된 요청입니다'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-Admin-User', 'X-Request-ID'],
    maxAge: 600,
  };
}

// ============================================
// 6. 요청 ID 추적
// ============================================
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  res.setHeader('X-Request-ID', requestId);
  (req as any).requestId = requestId;

  next();
};
