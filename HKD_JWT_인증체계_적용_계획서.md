# HKD JWT 기반 인증체계 — 주문 플로우 전체 적용 계획서

> 작성일: 2026-04-05
> 대상: HKD 배달 플랫폼 (Express.js 백엔드 + Next.js 프론트엔드)

---

## 1. 현재 상태 분석

### 1.1 기존 JWT 인프라 (이미 구현됨)

현재 `JWTTokenService`와 `auth.middleware.ts`에 기본적인 JWT 인프라가 갖춰져 있습니다.

| 구성 요소 | 현재 상태 |
|-----------|----------|
| `JWTTokenService` | Access Token(15분), Refresh Token(7일), Confirm Token 생성/검증 |
| `authenticateToken` | Bearer 토큰 검증 → DB에서 사용자 활성 상태 확인 |
| `authenticateAdmin` | X-Admin-Key(레거시) + X-Admin-Token(JWT) 이중 인증 |
| `authenticateDriver` | JWT 또는 전화번호 기반 인증 (하위호환) |
| `requireRole` | 역할 기반 접근 제어 (`user`, `driver`, `admin`) |

### 1.2 핵심 보안 취약점

코드 분석 결과, 주문 플로우의 대부분의 엔드포인트에 **인증 미들웨어가 적용되어 있지 않습니다**.

```
order.routes.ts 현재 상태:

POST   /api/v1/orders                  ← ❌ 인증 없음 (누구나 주문 생성 가능)
POST   /api/v1/orders/validate          ← ❌ 인증 없음
GET    /api/v1/orders                   ← ❌ 인증 없음 (phone 쿼리만으로 타인 주문 조회 가능)
GET    /api/v1/orders/:id               ← ❌ 인증 없음 (ID만 알면 누구의 주문이든 조회)
PUT    /api/v1/orders/:id/pickup-time   ← ❌ 인증 없음 (누구나 픽업 시간 변경 가능)
POST   /api/v1/orders/:id/pickup        ← ❌ 인증 없음 (누구나 픽업 처리 가능)
PUT    /api/v1/orders/:id/delivering    ← ❌ 인증 없음
PUT    /api/v1/orders/:id/complete      ← ❌ 인증 없음
GET    /api/v1/orders/pending           ← ❌ 인증 없음 (전체 대기 주문 노출)
GET    /api/v1/orders/pending-confirmation ← ❌ 인증 없음
GET    /api/v1/orders/confirmed         ← ❌ 인증 없음
```

### 1.3 JWTTokenService 보안 이슈

| 이슈 | 설명 | 위험도 |
|------|------|--------|
| **동일 시크릿 사용** | Access Token과 Refresh Token이 같은 `JWT_SECRET`을 사용. `.env`에 `JWT_REFRESH_SECRET`이 정의되어 있으나 실제 코드에서 미사용 | 🔴 높음 |
| **토큰 무효화 불가** | 토큰 블랙리스트/Revocation 메커니즘 없음. 탈취된 토큰을 만료 전까지 차단 불가 | 🔴 높음 |
| **배달원 전화번호 폴백** | `authenticateDriver`가 JWT 실패 시 `req.body.phone`이나 `req.query.phone`으로 폴백. 전화번호만 알면 배달원 사칭 가능 | 🟠 중간 |
| **Admin phone 접두어 방식** | 관리자 JWT의 phone 필드를 `admin:{id}` 형태로 사용. 토큰 타입 분리가 불완전 | 🟡 낮음 |

---

## 2. 적용 계획 개요

### 2.1 원칙

1. **단계적 적용** — 한 번에 전체를 바꾸지 않고, 우선순위에 따라 점진적으로 적용
2. **하위 호환성 유지** — ARS → SMS 링크 주문 플로우의 비로그인 고객 경험을 깨뜨리지 않음
3. **역할별 접근 분리** — 고객/식당/배달원/관리자 각각의 접근 범위를 명확히 설정
4. **최소 권한 원칙** — 각 엔드포인트에 필요한 최소 권한만 부여

### 2.2 HKD 특수 사항 — SMS 링크 주문 플로우

HKD의 핵심 사용자 흐름은 `ARS 전화 → SMS 링크 수신 → 웹에서 주문`입니다. 이 특성상 전통적인 로그인 → 토큰 발급 방식만으로는 부족하며, **전화번호 인증 기반의 경량 세션**이 필요합니다.

```
[ARS 전화] → [SMS 링크 발송] → [링크 클릭 → 웹 진입]
                                      │
                              ┌───────┴───────┐
                              │ 전화번호 인증   │  ← 이미 구현됨
                              │ (SMS 인증코드)  │
                              └───────┬───────┘
                                      │
                              ┌───────┴───────┐
                              │ JWT 발급       │  ← Access + Refresh
                              │ (httpOnly 쿠키) │
                              └───────┬───────┘
                                      │
                              ┌───────┴───────┐
                              │ 주문 생성/조회  │  ← 인증된 요청만 허용
                              └───────────────┘
```

---

## 3. 단계별 구현 계획

### Phase 1: JWTTokenService 보안 강화 (예상: 1일)

**목표:** 토큰 체계의 근본적인 보안 문제를 먼저 해결합니다.

#### 3.1.1 Access/Refresh 시크릿 분리

```typescript
// 변경 전 (현재)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 변경 후
const JWT_ACCESS_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set');
}
```

- `generateRefreshToken()`에서 `JWT_REFRESH_SECRET` 사용
- `refreshAccessToken()`에서 Refresh Token 검증 시 `JWT_REFRESH_SECRET` 사용
- 기존 `verifyToken()`은 Access Token 전용으로 유지

#### 3.1.2 토큰 페이로드에 역할(role) 추가

```typescript
interface TokenPayload {
  userId: string;
  phone: string;
  type: 'access' | 'refresh' | 'confirm';
  role: 'user' | 'driver' | 'admin';  // 신규 추가
  iat?: number;
  exp?: number;
}
```

#### 3.1.3 Refresh Token DB 저장 및 Revocation

```prisma
model RefreshToken {
  id          String   @id @default(uuid())
  token       String   @unique
  userId      String
  userType    String   // 'user' | 'driver' | 'admin'
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([token])
  @@map("refresh_tokens")
}
```

- 토큰 발급 시 DB에 저장
- `refreshAccessToken()` 시 DB에서 유효성 확인
- 로그아웃 시 `revokedAt` 설정으로 즉시 무효화
- 만료된 토큰은 주기적 배치로 정리

---

### Phase 2: 주문 생성 플로우 인증 적용 (예상: 2일)

**목표:** 가장 중요한 주문 생성 엔드포인트에 인증을 적용합니다.

#### 3.2.1 `optionalAuth` 미들웨어 신규 생성

SMS 링크를 통해 들어온 비인증 사용자도 전화번호 인증 과정을 거치면 주문할 수 있어야 합니다. 이를 위해 **선택적 인증 미들웨어**를 추가합니다.

```typescript
/**
 * 선택적 인증 미들웨어
 * - JWT가 있으면 검증하여 req.user에 설정
 * - JWT가 없으면 통과시키되 req.user는 undefined
 * - 잘못된 JWT가 있으면 401 반환 (토큰이 있는데 무효한 경우)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return next(); // 토큰 없으면 비인증 상태로 통과

  const decoded = jwtService.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, error: '만료된 토큰입니다. 다시 인증해주세요.' });
  }

  req.user = { userId: decoded.userId, phone: decoded.phone, role: decoded.role || 'user' };
  next();
};
```

#### 3.2.2 주문 생성 엔드포인트 변경

```typescript
// 변경 전
router.post('/', orderCreateRateLimit, validateCreateOrder, async (req, res, next) => {
  // phone만으로 사용자 조회/생성 — 누구나 가능

// 변경 후
router.post('/', authenticateToken, orderCreateRateLimit, validateCreateOrder, async (req, res, next) => {
  // req.user에서 인증된 사용자 정보 사용
  const userId = req.user.userId;
  // phone 파라미터 기반 사용자 생성 로직 제거
```

#### 3.2.3 프론트엔드 checkout 페이지 연동

`checkout/page.tsx`에서 주문 API 호출 시 JWT 포함:

```typescript
// 전화번호 인증 완료 후 받은 토큰을 저장
const { accessToken, refreshToken } = await verifyPhone(code);

// 주문 생성 시 Authorization 헤더 포함
const response = await fetch('/api/v1/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify(orderData),
});
```

#### 3.2.4 토큰 자동 갱신 유틸리티

```typescript
// utils/auth.ts
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let accessToken = getStoredAccessToken();

  let response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      redirectToPhoneVerification();
      return;
    }
    response = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
    });
  }

  return response;
}
```

---

### Phase 3: 주문 조회/추적 플로우 인증 적용 (예상: 1.5일)

**목표:** 고객이 본인의 주문만 조회할 수 있도록 제한합니다.

#### 3.3.1 엔드포인트별 인증 정책

| 엔드포인트 | 인증 방식 | 소유권 검증 |
|-----------|----------|------------|
| `GET /orders` | `authenticateToken` | `req.user.userId`로만 조회 (phone 파라미터 제거) |
| `GET /orders/:id` | `authenticateToken` | 주문의 `userId`와 `req.user.userId` 일치 확인 |
| `GET /orders/status/:orderNumber` | `authenticateToken` | 본인 주문만 조회 |
| `POST /orders/confirm/:token` | 인증 불필요 | Confirm Token 자체가 인증 역할 (기존 유지) |
| `POST /orders/cancel/:token` | 인증 불필요 | Confirm Token 자체가 인증 역할 (기존 유지) |

#### 3.3.2 소유권 검증 미들웨어

```typescript
/**
 * 주문 소유권 검증 미들웨어
 * - 고객: 본인 주문만 접근 가능
 * - 배달원: 자신에게 배정된 주문만 접근 가능
 * - 관리자: 모든 주문 접근 가능
 */
export const verifyOrderOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const orderId = req.params.id;
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

  switch (req.user.role) {
    case 'user':
      if (order.userId !== req.user.userId) {
        return res.status(403).json({ success: false, error: '본인의 주문만 조회할 수 있습니다' });
      }
      break;
    case 'driver':
      if (order.driverId !== req.user.userId) {
        return res.status(403).json({ success: false, error: '배정된 주문만 접근할 수 있습니다' });
      }
      break;
    case 'admin':
      break; // 관리자는 모든 주문 접근 가능
  }

  (req as any).order = order; // 이후 핸들러에서 재조회 방지
  next();
};
```

#### 3.3.3 주문 목록 조회 변경

```typescript
// 변경 전: phone 쿼리 파라미터로 누구나 조회
router.get('/', async (req, res) => {
  const { phone } = req.query;
  // ...

// 변경 후: 인증된 사용자의 주문만 조회
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user.userId;
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    // ...
  });
```

---

### Phase 4: 식당/배달원/관리자 엔드포인트 분리 (예상: 2일)

**목표:** 상태 변경 엔드포인트에 역할 기반 접근 제어를 적용합니다.

#### 3.4.1 엔드포인트별 최종 인증 정책

```
주문 생성/조회 (고객)
├─ POST   /orders                    → authenticateToken + requireRole('user')
├─ GET    /orders                    → authenticateToken + requireRole('user')
├─ GET    /orders/:id                → authenticateToken + verifyOrderOwnership
└─ POST   /orders/validate           → authenticateToken

주문 확정/취소 (토큰 기반 — 변경 없음)
├─ POST   /orders/confirm/:token     → (Confirm Token으로 인증)
└─ POST   /orders/cancel/:token      → (Confirm Token으로 인증)

식당 운영 (식당 관리자 또는 시스템 관리자)
├─ PUT    /orders/:id/pickup-time    → authenticateAdmin
└─ POST   /orders/:id/pickup         → authenticateAdmin

배달 운영 (배달원)
├─ PUT    /orders/:id/delivering     → authenticateDriver
└─ PUT    /orders/:id/complete       → authenticateDriver

관리자 대시보드 (관리자 전용)
├─ GET    /orders/pending            → authenticateAdmin
├─ GET    /orders/pending-confirmation → authenticateAdmin
└─ GET    /orders/confirmed          → authenticateAdmin
```

#### 3.4.2 배달원 전화번호 폴백 제거

```typescript
// 변경 전: 전화번호만으로 배달원 인증 가능 (위험)
const phone = req.body.phone || req.query.phone;
if (phone) {
  const driver = await prisma.driver.findUnique({ where: { phone } });
  // ...

// 변경 후: JWT 전용 인증
export const authenticateDriver = async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ error: '배달원 인증이 필요합니다' });

  const decoded = jwtService.verifyToken(token);
  if (!decoded || decoded.role !== 'driver') {
    return res.status(401).json({ error: '유효하지 않은 배달원 토큰입니다' });
  }

  const driver = await prisma.driver.findFirst({ where: { phone: decoded.phone } });
  if (!driver) return res.status(401).json({ error: '등록되지 않은 배달원입니다' });

  req.user = { userId: driver.id, phone: decoded.phone, role: 'driver' };
  next();
};
```

#### 3.4.3 관리자 인증 정리 — X-Admin-Key 단계적 제거

| 단계 | 작업 | 시점 |
|------|------|------|
| 1단계 | X-Admin-Key 사용 시 경고 로그 남기기 | Phase 4 |
| 2단계 | 프론트엔드의 모든 관리자 API 호출을 JWT 기반으로 전환 | Phase 4 |
| 3단계 | X-Admin-Key 방식 완전 제거 | Phase 5 이후 |

---

### Phase 5: 토큰 보안 고도화 (예상: 1.5일)

#### 3.5.1 토큰 저장 전략 (프론트엔드)

| 토큰 | 저장 위치 | 이유 |
|------|----------|------|
| Access Token | 메모리 (변수/Context) | XSS로부터 보호. 페이지 새로고침 시 Refresh로 재발급 |
| Refresh Token | httpOnly + Secure + SameSite=Strict 쿠키 | JS에서 접근 불가, CSRF 방어 |

#### 3.5.2 Refresh Token Rotation

```typescript
async refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
  // 1. DB에서 Refresh Token 유효성 확인
  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revokedAt) return null;

  // 2. 기존 Refresh Token 즉시 무효화 (Rotation)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  // 3. 새로운 Access + Refresh Token 쌍 발급
  const newAccessToken = this.generateAccessToken(stored.userId, stored.phone, stored.role);
  const newRefreshToken = this.generateRefreshToken(stored.userId, stored.phone, stored.role);

  // 4. 새 Refresh Token DB 저장
  await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: stored.userId, ... } });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}
```

#### 3.5.3 Refresh Token 재사용 탐지

이미 Rotation된(무효화된) Refresh Token이 사용될 경우, 해당 사용자의 **모든 Refresh Token을 무효화**합니다. 이는 토큰 탈취 시나리오를 방어합니다.

```typescript
if (stored.revokedAt) {
  // 이미 사용된 토큰 재사용 → 탈취 의심
  await prisma.refreshToken.updateMany({
    where: { userId: stored.userId },
    data: { revokedAt: new Date() },
  });
  logger.warn(`Refresh token reuse detected for user ${stored.userId}`);
  return null; // 사용자는 재인증 필요
}
```

---

## 4. 라우트 등록 순서 주의사항

`order.routes.ts`에서 Express 라우터의 경로 매칭 순서에 주의해야 합니다. `/orders/pending` 같은 정적 경로가 `/orders/:id` 같은 동적 경로보다 **먼저** 선언되어야 합니다.

```typescript
// ✅ 올바른 순서
router.get('/pending', authenticateAdmin, getPendingOrders);
router.get('/pending-confirmation', authenticateAdmin, getPendingConfirmationOrders);
router.get('/confirmed', authenticateAdmin, getConfirmedOrders);
router.get('/status/:orderNumber', authenticateToken, getOrderStatus);
router.get('/:id', authenticateToken, verifyOrderOwnership, getOrderById);
router.get('/', authenticateToken, getMyOrders);
```

---

## 5. 마이그레이션 체크리스트

### 5.1 백엔드

- [ ] `RefreshToken` Prisma 모델 추가 및 마이그레이션 실행
- [ ] `JWTTokenService`에 Refresh Secret 분리 적용
- [ ] `JWTTokenService`에 역할(role) 페이로드 추가
- [ ] Refresh Token Rotation 로직 구현
- [ ] `optionalAuth` 미들웨어 생성
- [ ] `verifyOrderOwnership` 미들웨어 생성
- [ ] `order.routes.ts` 전체 엔드포인트에 인증 미들웨어 적용
- [ ] `authenticateDriver`에서 전화번호 폴백 제거
- [ ] Refresh Token 정리 배치 작업 추가 (cron 또는 Supabase pg_cron)
- [ ] `POST /api/v1/auth/refresh` 엔드포인트 추가
- [ ] `POST /api/v1/auth/logout` 엔드포인트 추가 (Refresh Token 무효화)

### 5.2 프론트엔드

- [ ] `AuthContext` 생성 (Access Token 메모리 관리)
- [ ] Refresh Token을 httpOnly 쿠키로 전환
- [ ] `fetchWithAuth` 유틸리티 구현 (자동 갱신 포함)
- [ ] `checkout/page.tsx`에서 인증 헤더 추가
- [ ] `my-orders/page.tsx`에서 phone 쿼리 → 토큰 기반 조회로 전환
- [ ] `order/[id]/page.tsx`에서 인증 헤더 추가
- [ ] 배달원 페이지(`driver/page.tsx`)에서 JWT 기반 인증 적용
- [ ] 관리자 페이지에서 X-Admin-Key → JWT 전환 (AdminAuthContext 업데이트)

### 5.3 배포

- [ ] Fly.io 환경변수에 `JWT_REFRESH_SECRET`이 설정되어 있는지 확인
- [ ] 기존 발급된 토큰과의 호환성 테스트 (시크릿 변경 시 전체 재로그인 필요)
- [ ] API 응답에서 적절한 401/403 에러 메시지 확인 (다국어 대응)

---

## 6. 구현 우선순위 및 일정

```
Week 1
├── Phase 1: JWTTokenService 보안 강화              [1일]
│   └── 시크릿 분리, role 페이로드, RefreshToken DB
├── Phase 2: 주문 생성 플로우 인증 적용              [2일]
│   └── authenticateToken → POST /orders, 프론트엔드 연동
└── 테스트 및 QA                                    [1일]

Week 2
├── Phase 3: 주문 조회/추적 플로우 인증 적용          [1.5일]
│   └── 소유권 검증, 주문 목록 조회 변경
├── Phase 4: 식당/배달원/관리자 엔드포인트 분리        [2일]
│   └── 역할 기반 접근 제어, 배달원 폴백 제거
└── 통합 테스트 및 배포                              [1일]

Week 3
├── Phase 5: 토큰 보안 고도화                        [1.5일]
│   └── Refresh Token Rotation, httpOnly 쿠키
└── 모니터링 및 안정화                               [1일]
```

---

## 7. 테스트 계획

### 7.1 단위 테스트

- JWTTokenService: 시크릿 분리 후 토큰 생성/검증 정상 동작
- Refresh Token Rotation: 새 토큰 발급 + 기존 토큰 무효화
- 재사용 탐지: 무효화된 토큰 사용 시 전체 세션 종료

### 7.2 통합 테스트

- 전체 주문 플로우: 전화번호 인증 → 토큰 발급 → 주문 생성 → 주문 조회
- 토큰 만료 시나리오: Access Token 만료 → 자동 갱신 → 주문 계속 진행
- 권한 위반 시나리오: 고객이 타인 주문 조회 → 403, 비인증 주문 생성 → 401

### 7.3 보안 테스트

- 만료된 Access Token으로 주문 생성 시도 → 401
- 유효한 Refresh Token으로 Access Token이 아닌 리소스 접근 시도 → 401
- Rotation된 Refresh Token 재사용 → 전체 세션 무효화 확인
- 타인의 주문 ID로 조회/수정 시도 → 403
