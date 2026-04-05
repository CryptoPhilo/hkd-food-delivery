import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { AppError } from './utils/errors';

import orderRoutes from './routes/order.routes';
import adminRoutes from './routes/admin.routes';
import adminAuthRoutes from './routes/admin-auth.routes';
import webhookRoutes from './routes/webhook.routes';
import settingsRoutes from './routes/settings.routes';
import restaurantRoutes from './routes/restaurant.routes';
import deliveryRoutes from './routes/delivery.routes';
import authRoutes from './routes/auth.routes';
import driverRoutes from './routes/driver.routes';
import settlementRoutes from './routes/settlement.routes';
import driverSettlementRoutes from './routes/driver-settlement.routes';
import ageVerificationRoutes from './routes/age-verification.routes';
import healthRoutes from './routes/health.routes';
import notificationRoutes from './routes/notification.routes';
import sseRoutes from './routes/sse.routes';
import thumbnailRoutes from './routes/thumbnail.routes';
import paymentRoutes from './routes/payment.routes';
import aiImageRoutes from './routes/ai-image.routes';

// 보안 미들웨어 임포트
import {
  securityHeaders,
  apiRateLimit,
  sanitizeInput,
  requestIdMiddleware,
  getCorsOptions,
} from './middleware/security.middleware';
import { authenticateAdmin } from './middleware/auth.middleware';

// 로깅 미들웨어 임포트
import { httpLogger, errorLogger } from './middleware/logging.middleware';
import logger from './utils/logger';

const app = express();

// Fly.io 등 리버스 프록시 뒤에서 실제 클라이언트 IP를 사용
app.set('trust proxy', true);

// [SECURITY] Express 기본 x-powered-by 헤더 비활성화 (MEDIUM-03)
app.disable('x-powered-by');

// ============================================
// 글로벌 보안 미들웨어
// ============================================

// 1. 요청 ID 추적 (모든 요청에 고유 ID 부여)
app.use(requestIdMiddleware);

// 2. 보안 헤더 설정 (XSS, Clickjacking, MIME sniffing 방어)
app.use(securityHeaders);

// 3. CORS 설정 (프로덕션 환경 화이트리스트 지원)
// [SECURITY] OPTIONS preflight 요청에 대해 명시적으로 204 반환 (MEDIUM-05)
const corsOptions = getCorsOptions();
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// 4. 쿠키 파서 (httpOnly 쿠키 기반 Refresh Token 지원)
app.use(cookieParser());

// 5. JSON 파서 (크기 제한: 2MB)
app.use(express.json({ limit: '2mb' }));

// 5. URL 인코딩 파서 (크기 제한)
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 6. API Rate Limiting (IP당 15분에 500회)
app.use('/api', apiRateLimit);

// 7. 입력값 정제 (XSS, SQL Injection 방어)
app.use(sanitizeInput);

// 8. HTTP 요청/응답 로깅
app.use(httpLogger);

// 9. 요청 타임아웃 (30초, 환경변수로 변경 가능)
app.use((req, res, next) => {
  const timeout = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);
  req.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: '요청 시간이 초과되었습니다',
        code: 'REQUEST_TIMEOUT',
      });
    }
  });
  next();
});

// ============================================
// 라우트 설정
// ============================================

// 공개 라우트 (인증 불필요)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/restaurants', restaurantRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// 결제 라우트 (결제 검증은 공개, 취소는 내부에서 권한 처리)
app.use('/api/v1/payments', paymentRoutes);

// 주문 라우트 (인증은 라우트 내부 미들웨어에서 역할별로 처리)
// - POST / : authenticateToken (고객 인증 필수)
// - GET / : authenticateToken (고객 인증 필수)
// - GET /:id : authenticateAny + verifyOrderOwnership (다중 역할 + 소유권 검증)
// - GET /pending, /pending-confirmation, /confirmed : authenticateAdmin (관리자 전용)
// - PUT /:id/delivering, /complete : authenticateDriver (배달원 전용)
// - PUT /:id/pickup-time, POST /:id/pickup : authenticateAdmin (관리자 전용)
// - POST /confirm/:token, /cancel/:token : Confirm Token 기반 (인증 불필요)
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1/age-verification', ageVerificationRoutes);

// 배달원 라우트 (라우트 내부에서 인증 처리)
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/drivers/:driverId/settlements', driverSettlementRoutes);

// 실시간 이벤트 (SSE)
app.use('/api/v1/events', sseRoutes);

// 관리자 인증 라우트 (로그인/설정은 인증 불필요, 나머지는 내부에서 처리)
app.use('/api/v1/admin/auth', adminAuthRoutes);

// 썸네일 라우트 (조회는 공개, 수정은 어드민 인증 필요)
app.use('/api/v1/thumbnails', thumbnailRoutes);
app.use('/api/v1/admin/thumbnails', authenticateAdmin, thumbnailRoutes);

// AI 이미지 생성 라우트 (관리자 인증 필수)
app.use('/api/v1/admin/ai-images', authenticateAdmin, aiImageRoutes);

// 관리자 라우트 (관리자 인증 필수)
app.use('/api/v1/admin', authenticateAdmin, adminRoutes);
app.use('/api/v1/admin/notifications', authenticateAdmin, notificationRoutes);
app.use('/api/v1/settlements', authenticateAdmin, settlementRoutes);
app.use('/api/v1/settings', authenticateAdmin, settingsRoutes);

// ============================================
// 헬스 체크 (인증 불필요)
// ============================================
app.use('/health', healthRoutes);

// ============================================
// 정적 웹페이지 (이용약관, 개인정보처리방침, 환불정책)
// ============================================
const publicDir = path.join(__dirname, '../public');
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(publicDir, 'terms.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(publicDir, 'privacy.html')));
app.get('/refund', (req, res) => res.sendFile(path.join(publicDir, 'refund.html')));

// ============================================
// 에러 로깅 미들웨어
// ============================================
app.use(errorLogger);

// ============================================
// 글로벌 에러 핸들러
// ============================================
app.use((err: AppError | Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const statusCode = err instanceof AppError
    ? err.statusCode
    : (err as any).status || (err as any).statusCode || 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';

  logger.error(`[ERROR] ${req.method} ${req.path}: ${err.message}`, {
    statusCode,
    code,
    requestId: (req as any).requestId,
  });

  // 프로덕션에서는 에러 상세 정보 숨기기
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(statusCode).json({
    success: false,
    error: isDev ? err.message : '서버 내부 오류가 발생했습니다',
    code,
    ...(isDev && { stack: err.stack }),
    meta: { requestId: (req as any).requestId },
  });
});

// 404 핸들러
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    error: '요청한 리소스를 찾을 수 없습니다',
    code: 'NOT_FOUND',
    meta: { requestId: (req as any).requestId },
  });
});

export default app;
