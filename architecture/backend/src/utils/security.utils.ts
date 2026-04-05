/**
 * 보안 유틸리티 함수 모음
 */

import crypto from 'crypto';
import logger from './logger';

// ============================================
// 감사 로깅 (Audit Log)
// ============================================

interface AuditLogEntry {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

interface SecurityEvent {
  type: string;
  ip?: string;
  userId?: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

export const auditLogger = {
  log(entry: AuditLogEntry) {
    const logEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
    };
    logger.info('[AUDIT] ' + entry.action, logEntry);
  },

  logSecurityEvent(event: SecurityEvent) {
    const logEntry = {
      ...event,
      timestamp: event.timestamp || new Date(),
    };
    logger.warn('[SECURITY] ' + event.type, logEntry);
  },
};

// ============================================
// 웹훅 서명 검증 (PortOne)
// ============================================

/**
 * PortOne 웹훅 서명 검증
 * @param rawBody - 원본 요청 본문
 * @param signature - 헤더의 webhook-signature 값
 * @param secret - PortOne 웹훅 시크릿
 * @returns 검증 결과
 */
export function verifyPortOneWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch (error) {
    logger.error('[SECURITY] Webhook signature verification failed', { error });
    return false;
  }
}

// ============================================
// 데이터 마스킹
// ============================================

/**
 * 민감한 정보 마스킹 (로깅용)
 */
export function maskSensitiveData(data: any, keysToMask: string[] = []): any {
  if (!data || typeof data !== 'object') return data;

  const defaultMaskKeys = ['password', 'token', 'secret', 'apiKey', 'cardNumber', 'ssn'];
  const allMaskKeys = [...new Set([...defaultMaskKeys, ...keysToMask])];

  const masked: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (allMaskKeys.includes(key)) {
      masked[key] = '***MASKED***';
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

// ============================================
// Rate Limiting 헬퍼
// ============================================

/**
 * IP 주소 마스킹 (프라이버시 보호)
 */
export function maskIpAddress(ip: string | undefined): string {
  if (!ip) return 'unknown';

  const parts = ip.split('.');
  if (parts.length === 4) {
    return parts.slice(0, 3).join('.') + '.***';
  }

  return ip.substring(0, Math.ceil(ip.length / 2)) + '***';
}

/**
 * 휴대폰 번호 마스킹
 */
export function maskPhoneNumber(phone: string): string {
  if (phone.length < 10) return '***';
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 3);
}
