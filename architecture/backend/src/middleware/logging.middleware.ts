/**
 * 한경배달 - HTTP 요청/응답 로깅 미들웨어
 *
 * 기능:
 * - 모든 HTTP 요청/응답의 구조화된 로깅
 * - 응답 시간 측정
 * - 에러 응답 자동 감지 및 경고
 * - 민감 정보 마스킹 (Authorization 헤더, 비밀번호 등)
 * - 요청 메트릭 수집 (운영 대시보드용)
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// 메트릭 수집기
interface RequestMetrics {
  totalRequests: number;
  totalErrors: number;
  statusCounts: Record<number, number>;
  avgResponseTime: number;
  maxResponseTime: number;
  responseTimes: number[];
  endpointCounts: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  lastHourRequests: { timestamp: number; path: string; status: number; duration: number }[];
}

class MetricsCollector {
  private metrics: RequestMetrics = {
    totalRequests: 0,
    totalErrors: 0,
    statusCounts: {},
    avgResponseTime: 0,
    maxResponseTime: 0,
    responseTimes: [],
    endpointCounts: {},
    errorsByEndpoint: {},
    lastHourRequests: [],
  };

  private startTime = Date.now();

  record(path: string, status: number, duration: number) {
    this.metrics.totalRequests++;
    if (status >= 400) this.metrics.totalErrors++;

    // 상태 코드별 카운트
    this.metrics.statusCounts[status] = (this.metrics.statusCounts[status] || 0) + 1;

    // 응답 시간 통계 (최근 1000개만 유지)
    this.metrics.responseTimes.push(duration);
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes.shift();
    }
    this.metrics.avgResponseTime =
      this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
    if (duration > this.metrics.maxResponseTime) {
      this.metrics.maxResponseTime = duration;
    }

    // 엔드포인트별 카운트 (첫 3 세그먼트)
    const endpoint = this.normalizeEndpoint(path);
    this.metrics.endpointCounts[endpoint] = (this.metrics.endpointCounts[endpoint] || 0) + 1;
    if (status >= 400) {
      this.metrics.errorsByEndpoint[endpoint] = (this.metrics.errorsByEndpoint[endpoint] || 0) + 1;
    }

    // 최근 1시간 기록 (최대 5000개)
    const now = Date.now();
    this.metrics.lastHourRequests.push({ timestamp: now, path: endpoint, status, duration });
    // 1시간 이상 된 데이터 정리
    const oneHourAgo = now - 60 * 60 * 1000;
    this.metrics.lastHourRequests = this.metrics.lastHourRequests.filter(
      (r) => r.timestamp > oneHourAgo
    );
    if (this.metrics.lastHourRequests.length > 5000) {
      this.metrics.lastHourRequests = this.metrics.lastHourRequests.slice(-5000);
    }
  }

  private normalizeEndpoint(path: string): string {
    // UUID/ID 파라미터를 :id로 치환
    return path.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id'
    ).replace(/\/\d+/g, '/:id');
  }

  getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const errorRate = this.metrics.totalRequests > 0
      ? ((this.metrics.totalErrors / this.metrics.totalRequests) * 100).toFixed(2)
      : '0';

    // 최근 1분 RPS 계산
    const oneMinAgo = Date.now() - 60 * 1000;
    const recentRequests = this.metrics.lastHourRequests.filter((r) => r.timestamp > oneMinAgo);
    const rps = (recentRequests.length / 60).toFixed(2);

    // 상위 에러 엔드포인트
    const topErrors = Object.entries(this.metrics.errorsByEndpoint)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // 상위 트래픽 엔드포인트
    const topEndpoints = Object.entries(this.metrics.endpointCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // P95 응답 시간
    const sorted = [...this.metrics.responseTimes].sort((a, b) => a - b);
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const p99 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0;

    return {
      uptime,
      totalRequests: this.metrics.totalRequests,
      totalErrors: this.metrics.totalErrors,
      errorRate: `${errorRate}%`,
      rps,
      responseTime: {
        avg: Math.round(this.metrics.avgResponseTime),
        max: Math.round(this.metrics.maxResponseTime),
        p95: Math.round(p95),
        p99: Math.round(p99),
      },
      statusCounts: this.metrics.statusCounts,
      topEndpoints,
      topErrors,
    };
  }

  getRecentErrors(limit: number = 20) {
    return this.metrics.lastHourRequests
      .filter((r) => r.status >= 400)
      .slice(-limit)
      .reverse();
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      statusCounts: {},
      avgResponseTime: 0,
      maxResponseTime: 0,
      responseTimes: [],
      endpointCounts: {},
      errorsByEndpoint: {},
      lastHourRequests: [],
    };
  }
}

// 싱글톤 메트릭 수집기
export const metricsCollector = new MetricsCollector();

// 민감 헤더 마스킹
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key'];
const SENSITIVE_BODY_KEYS = ['password', 'token', 'secret', 'apiKey', 'cardNumber'];

function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const masked: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase()) || SENSITIVE_BODY_KEYS.includes(key)) {
      masked[key] = '***MASKED***';
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

/**
 * HTTP 요청/응답 로깅 미들웨어
 */
export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();
  const requestId = (req as any).requestId || req.headers['x-request-id'] || '-';

  // 요청 로그
  logger.http(`→ ${req.method} ${req.originalUrl}`, {
    requestId,
    method: req.method,
    path: req.originalUrl,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent')?.substring(0, 100),
  });

  // 응답 완료 시 로깅
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // ms
    const status = res.statusCode;

    // 메트릭 수집
    metricsCollector.record(req.originalUrl, status, duration);

    // 응답 로그
    const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'http';
    logger.log(logLevel, `← ${req.method} ${req.originalUrl} ${status} ${duration.toFixed(1)}ms`, {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      duration: Math.round(duration),
      contentLength: res.get('content-length'),
    });

    // 느린 응답 경고 (3초 이상)
    if (duration > 3000) {
      logger.warn(`느린 응답 감지: ${req.method} ${req.originalUrl} (${duration.toFixed(0)}ms)`, {
        requestId,
        duration: Math.round(duration),
      });
    }

    return originalEnd.apply(this, args as any);
  } as any;

  next();
}

/**
 * 에러 로깅 미들웨어
 */
export function errorLogger(err: any, req: Request, res: Response, next: NextFunction) {
  const requestId = (req as any).requestId || '-';

  logger.error(`예외 발생: ${err.message}`, {
    requestId,
    method: req.method,
    path: req.originalUrl,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    errorName: err.name,
    statusCode: err.status || err.statusCode || 500,
  });

  next(err);
}
