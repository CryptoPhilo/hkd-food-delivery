/**
 * Redis 서비스 (옵션)
 * - Redis가 설정되지 않은 경우 메모리 기반 폴백 사용
 */

import logger from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || '';

// 메모리 기반 간단한 캐시 (Redis 미연결 시 폴백)
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

class RedisService {
  private static instance: RedisService;
  private client: any = null;
  private isConnected = false;

  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private constructor() {
    if (REDIS_URL) {
      this.connect();
    } else {
      logger.warn('[Redis] REDIS_URL 미설정 - 메모리 캐시 모드로 동작합니다');
    }
  }

  private async connect() {
    try {
      const Redis = require('ioredis');
      this.client = new Redis(REDIS_URL);
      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('[Redis] 연결 성공');
      });
      this.client.on('error', (err: any) => {
        logger.error('[Redis] 연결 에러', { error: err.message });
        this.isConnected = false;
      });
    } catch (err: any) {
      logger.warn('[Redis] ioredis 모듈 없음 - 메모리 캐시 모드로 동작', { error: err.message });
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      return this.client.get(key);
    }
    // 메모리 폴백
    const item = memoryCache.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isConnected && this.client) {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return;
    }
    // 메모리 폴백
    memoryCache.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity,
    });
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      await this.client.del(key);
      return;
    }
    memoryCache.delete(key);
  }

  async incr(key: string): Promise<number> {
    if (this.isConnected && this.client) {
      return this.client.incr(key);
    }
    const current = await this.get(key);
    const newVal = parseInt(current || '0', 10) + 1;
    await this.set(key, String(newVal));
    return newVal;
  }

  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    if (this.isConnected && this.client) {
      // Redis implementation
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      const ttl = await this.client.ttl(key);
      const resetAt = now + (ttl > 0 ? ttl * 1000 : windowMs);
      const remaining = Math.max(0, maxRequests - current);
      return {
        allowed: current <= maxRequests,
        remaining,
        resetAt,
      };
    }

    // Memory fallback
    const key_count = `${key}:count`;
    const key_reset = `${key}:reset`;

    const countItem = memoryCache.get(key_count);
    const resetItem = memoryCache.get(key_reset);

    const resetAt = resetItem ? parseInt(resetItem.value, 10) : now + windowMs;
    if (now >= resetAt) {
      // Window expired, reset
      memoryCache.set(key_count, { value: '1', expiresAt: now + windowMs + 1000 });
      memoryCache.set(key_reset, {
        value: String(now + windowMs),
        expiresAt: now + windowMs + 1000,
      });
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
    }

    const current = countItem ? parseInt(countItem.value, 10) + 1 : 1;
    memoryCache.set(key_count, { value: String(current), expiresAt: resetAt + 1000 });
    const remaining = Math.max(0, maxRequests - current);

    return { allowed: current <= maxRequests, remaining, resetAt };
  }

  async healthCheck(): Promise<{ status: string; mode: string; latency: number }> {
    const startTime = Date.now();
    try {
      if (this.isConnected && this.client) {
        const result = await this.client.ping();
        const latency = Date.now() - startTime;
        return {
          status: result === 'PONG' ? 'healthy' : 'unhealthy',
          mode: 'redis',
          latency,
        };
      }
      return {
        status: 'healthy',
        mode: 'memory',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        mode: this.isConnected ? 'redis' : 'memory',
        latency: Date.now() - startTime,
      };
    }
  }

  getStatus(): { connected: boolean; mode: string } {
    return {
      connected: this.isConnected,
      mode: this.isConnected ? 'redis' : 'memory',
    };
  }
}

export const redisService = RedisService.getInstance();
export default RedisService;
