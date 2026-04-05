/**
 * 한경배달 - 헬스체크 및 운영 엔드포인트
 *
 * GET /health          - 간단 헬스체크 (로드밸런서/Docker용)
 * GET /health/detailed - 상세 헬스체크 (DB, 메모리, 디스크 등)
 * GET /health/ready    - Readiness 체크 (서비스 준비 상태)
 * GET /health/metrics  - 운영 메트릭 (admin 인증 필요)
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as os from 'os';
import * as fs from 'fs';
import { metricsCollector } from '../middleware/logging.middleware';
import { redisService as redis } from '../services/RedisService';

const router = Router();
const prisma = new PrismaClient();

const START_TIME = Date.now();

// 간단 헬스체크 (Docker HEALTHCHECK / 로드밸런서)
// [SECURITY] uptime 필드 제거 — 서버 재시작 시점 노출 방지 (MEDIUM-01)
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// 상세 헬스체크
router.get('/detailed', async (req: Request, res: Response) => {
  const checks: Record<string, { status: string; detail?: any; latency?: number }> = {};

  // 1. 데이터베이스 체크
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    checks.database = { status: 'healthy', latency: dbLatency };
  } catch (error: any) {
    checks.database = { status: 'unhealthy', detail: error.message };
  }

  // 1.5 Redis 체크
  try {
    const redisHealth = await redis.healthCheck();
    checks.redis = {
      status: redisHealth.status,
      detail: { mode: redisHealth.mode, latency: redisHealth.latency },
    };
  } catch (error: any) {
    checks.redis = { status: 'unhealthy', detail: error.message };
  }

  // 2. 메모리 체크
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsedPercent = ((1 - freeMem / totalMem) * 100).toFixed(1);
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);

  checks.memory = {
    status: heapUsedMB < 512 ? 'healthy' : 'warning',
    detail: {
      heap: `${heapUsedMB}/${heapTotalMB}MB`,
      rss: `${rssMB}MB`,
      system: `${memUsedPercent}% used`,
    },
  };

  // 3. 디스크 체크 (DB 파일)
  try {
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db';
    const resolvedPath = dbPath.startsWith('/') ? dbPath : require('path').resolve(process.cwd(), dbPath);
    if (fs.existsSync(resolvedPath)) {
      const stat = fs.statSync(resolvedPath);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
      checks.disk = {
        status: stat.size < 500 * 1024 * 1024 ? 'healthy' : 'warning', // 500MB 경고
        detail: { dbSize: `${sizeMB}MB`, lastModified: stat.mtime.toISOString() },
      };
    } else {
      checks.disk = { status: 'warning', detail: 'DB 파일을 찾을 수 없음' };
    }
  } catch {
    checks.disk = { status: 'unknown' };
  }

  // 4. CPU 부하
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  checks.cpu = {
    status: loadAvg[0] < cpuCount * 0.8 ? 'healthy' : 'warning',
    detail: {
      loadAvg: loadAvg.map((l) => l.toFixed(2)),
      cores: cpuCount,
    },
  };

  // 종합 상태 판정
  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
  const hasUnhealthy = Object.values(checks).some((c) => c.status === 'unhealthy');

  const overallStatus = hasUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';

  res.status(overallStatus === 'unhealthy' ? 503 : 200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    version: process.env.npm_package_version || '1.0.0',
    node: process.version,
    environment: process.env.NODE_ENV || 'development',
    checks,
  });
});

// Readiness 체크 (K8s readiness probe 등)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false, reason: 'database not ready' });
  }
});

// 운영 메트릭 (관리자용)
router.get('/metrics', (req: Request, res: Response) => {
  // 간단한 API 키 체크 (admin 인증 미들웨어 이전에 실행되므로)
  const apiKey = req.headers['x-api-key'];
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && apiKey !== adminKey) {
    return res.status(401).json({ error: '인증이 필요합니다' });
  }

  const metrics = metricsCollector.getMetrics();
  const memUsage = process.memoryUsage();

  res.json({
    success: true,
    data: {
      ...metrics,
      process: {
        pid: process.pid,
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024),
        freeMemory: Math.round(os.freemem() / 1024 / 1024),
        loadAvg: os.loadavg().map((l) => parseFloat(l.toFixed(2))),
      },
    },
  });
});

// 최근 에러 목록 (관리자용)
router.get('/errors', (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'];
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && apiKey !== adminKey) {
    return res.status(401).json({ error: '인증이 필요합니다' });
  }

  const limit = parseInt(req.query.limit as string) || 20;
  const errors = metricsCollector.getRecentErrors(limit);

  res.json({ success: true, data: errors });
});

export default router;
