# 한경 음식배달 서비스 아키텍처 설계서

## 1. 프로젝트 개요

### 1.1 서비스 플로우

```
1. 사용자가 指定 전화번호로 전화 → 끊음
2. 시스템이 발신번호 확인 → SMS로 URL 발송
3. 사용자가 URL 클릭 → 웹 접속
4. 영업시간 체크:
   - 영업종료 → "배달 불가" 안내 페이지
   - 영업중 → 배달 가능한 식당 목록呈现
5. 사용자: 식당/메뉴 선택 → 배달비 계산 → 카드 결제
6. 시스템: 픽업 시간 확인 → 고객에게 확정 링크 전송
7. 고객: 주문 확정/취소
   - 취소 → 카드 취소 처리
   - 확정 → 주문 진행
8. 배달업체: 식당에 주문 → 픽업 → 배달 → 완료
```

### 1.2 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| SMS/ARS | 알리고 (Aligo) API |
| Maps | Naver Maps API |
| Payment | PortOne (포트원) |
| Auth | JWT + Refresh Token |

---

## 2. 시스템 아키텍처

### 2.1 Overall Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Next.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Landing Page│  │ Order Page   │  │  Order Confirm Page  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Express)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  /api/v1/*  (Routes + Middleware: Auth, Rate Limit)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Order      │    │  Restaurant   │    │   Payment     │
│   Service    │    │   Service     │    │   Service     │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ▼
              ┌─────────────────────────┐
              │     PostgreSQL          │
              │   (Primary Database)    │
              └─────────────────────────┘
```

### 2.2 Module Structure

```
/backend
├── src/
│   ├── config/           # 환경설정
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── env.ts
│   ├── modules/          # 핵심 도메인 모듈
│   │   ├── auth/
│   │   ├── user/
│   │   ├── restaurant/
│   │   ├── order/
│   │   ├── payment/
│   │   ├── delivery/
│   │   └── sms/
│   ├── services/         # Business Logic
│   │   ├── OrderService.ts
│   │   ├── RestaurantService.ts
│   │   ├── PaymentService.ts
│   │   └── DeliveryFeeCalculator.ts
│   ├── utils/            # 유틸리티
│   │   ├── haversine.ts
│   │   ├── naverMap.ts
│   │   └── validators.ts
│   ├── middleware/       # Express Middleware
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   └── rateLimiter.ts
│   ├── routes/           # API Routes
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── restaurant.routes.ts
│   │   ├── order.routes.ts
│   │   └── webhook.routes.ts
│   ├── hooks/            # Webhook Handlers
│   │   ├── twilio.webhook.ts
│   │   ├── portone.webhook.ts
│   │   └── naverMap.webhook.ts
│   └── app.ts            # Express App Entry
├── prisma/
│   └── schema.prisma     # DB Schema
└── package.json

/frontend (Next.js)
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing (영업시간 분기)
│   │   ├── layout.tsx
│   │   ├── restaurants/
│   │   │   └── page.tsx          # 식당 목록
│   │   ├── menu/
│   │   │   └── [restaurantId]/
│   │   │       └── page.tsx      # 메뉴 선택
│   │   ├── cart/
│   │   │   └── page.tsx          # 장바구니/결제
│   │   ├── order/
│   │   │   └── [orderId]/
│   │   │       └── page.tsx      # 주문 현황
│   │   ├── confirm/
│   │   │   └── [token]/
│   │   │       └── page.tsx      # 주문 확정 페이지
│   │   └── closed/
│   │       └── page.tsx          # 영업 종료 안내
│   ├── components/
│   │   ├── ui/                   # 공통 UI
│   │   ├── restaurant/           # 식당 관련
│   │   ├── menu/                 # 메뉴 관련
│   │   ├── order/                # 주문 관련
│   │   └── map/                  # 지도 관련
│   ├── hooks/                    # Custom Hooks
│   │   ├── useOrder.ts
│   │   ├── useCart.ts
│   │   └── useDeliveryFee.ts
│   ├── services/                # API Client
│   │   ├── api.ts
│   │   ├── restaurant.api.ts
│   │   ├── order.api.ts
│   │   └── payment.api.ts
│   ├── stores/                  # State Management
│   │   ├── cartStore.ts
│   │   └── orderStore.ts
│   ├── types/                    # TypeScript Types
│   │   ├── restaurant.ts
│   │   ├── order.ts
│   │   └── user.ts
│   └── utils/
│       ├── deliveryFee.ts        # Haversine 계산
│       └── formatters.ts
├── public/
├── next.config.js
└── package.json
```

---

## 3. Database Schema (PostgreSQL)

### 3.1 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    Users    │       │ Restaurants │       │  Settings   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ phone       │       │ naver_id    │       │ key         │
│ name        │       │ name        │       │ value       │
│ email       │◄──────│ address     │       │ type        │
│ password    │       │ latitude    │       │ category    │
│ created_at  │       │ longitude   │       └─────────────┘
│ updated_at  │       │ phone       │
└─────────────┘       │ is_active   │
      │               │ created_at  │
      │               │ updated_at  │
      │               └─────────────┘
      │                     │
      │               ┌─────┴─────┐
      │               │           │
      │         ┌─────▼─────┐ ┌───▼────┐
      │         │  Menus   │ │ Orders │
      │         ├──────────┤ ├────────┤
      │         │ id (PK)  │ │ id (PK)│
      │         │ restaurant_id (FK) │ user_id (FK) │
      │         │ name     │ │ restaurant_id (FK) │
      │         │ price    │ │ status         │
      │         │ image_url│ │ total_amount  │
      │         │ is_available │ delivery_fee │
      │         │ created_at│ │ delivery_address │
      │         └──────────┘ │ latitude      │
      │                      │ longitude     │
      │                      │ estimated_time│
      │                      │ paid_at       │
      │                      │ confirmed_at  │
      │                      │ picked_up_at  │
      │                      │ delivered_at  │
      │                      │ created_at    │
      │                      │ updated_at    │
      │                      └───────┬────────┘
      │                              │
      │                        ┌─────▼─────┐
      │                        │OrderItems│
      │                        ├──────────┤
      │                        │ id (PK)  │
      │                        │ order_id (FK) │
      │                        │ menu_id (FK)  │
      │                        │ menu_name     │
      │                        │ quantity      │
      │                        │ unit_price    │
      │                        │ subtotal      │
      │                        └──────────────┘
```

### 3.2 Prisma Schema (SQL)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// Users Table - 고객 정보
// ============================================
model User {
  id        String   @id @default(uuid())
  phone     String   @unique // 발신번호 (테스트: 010-xxxx-xxxx)
  name      String?
  email     String?  @unique
  password  String?  // Nullable: 전화번호로만 인증 시 null
  fcm_token String?  // Firebase Cloud Messaging Token
  is_active Boolean @default(true)
  
  orders    Order[]
  
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([phone])
}

// ============================================
// Restaurants Table - 식당 정보 (Naver Map 데이터)
// ============================================
model Restaurant {
  id              String   @id @default(uuid())
  naver_place_id  String   @unique // 네이버 지도 Place ID
  
  name            String
  address         String
  road_address    String?
  latitude        Float    // 위도 (Naver API)
  longitude       Float    // 경도 (Naver API)
  
  phone           String?
  category        String?  // 업종 (음식점 종류)
  business_status String?  // 영업상태 (open/closed)
  
  image_url       String?
  rating          Float?   // 네이버 평점
  
  is_active       Boolean  @default(true) // 관리자가 활성화/비활성화
  is_deliverable  Boolean  @default(true) // 배달 가능 여부
  
  delivery_radius Float?   @default(3.0) // 배달 반경 (km)
  
  menus           Menu[]
  orders          Order[]
  
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  @@index([naver_place_id])
  @@index([is_active, is_deliverable])
  @@index([latitude, longitude]) // 근처 식당 검색용
}

// ============================================
// Menus Table - 메뉴 정보
// ============================================
model Menu {
  id            String   @id @default(uuid())
  restaurant_id String
  
  naver_menu_id String?  // 네이버 메뉴 ID (있다면)
  name          String
  description   String?
  price         Int      // 원 단위
  image_url     String?
  
  is_available  Boolean  @default(true) // 현재 주문 가능 여부
  is_active     Boolean  @default(true) // 메뉴 사용 여부
  
  order_items   OrderItem[]
  
  restaurant    Restaurant @relation(fields: [restaurant_id], references: [id], onDelete: Cascade)
  
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@index([restaurant_id, is_available])
}

// ============================================
// Orders Table - 주문 정보
// ============================================
model Order {
  id              String   @id @default(uuid())
  order_number    String   @unique // 주문 번호 (YYYYMMDD + 6자리)
  
  user_id         String
  restaurant_id   String
  
  // 주문 상태
  // pending: 결제 완료, 확정 대기중
  // confirmed: 고객 확정됨
  // preparing: 조리중
  // picked_up: 픽업됨
  // delivering: 배달중
  // completed: 배달 완료
  // cancelled: 취소됨
  status          OrderStatus @default(.pending)
  
  // 금액 정보
  subtotal        Int      // 상품 금액 합계
  delivery_fee    Int      // 배달비
  total_amount    Int      // 총 금액 (subtotal + delivery_fee)
  
  // 배달 주소
  delivery_address String
  delivery_latitude Float
  delivery_longitude Float
  
  // 예상 시간
  estimated_pickup_time DateTime? // 픽업 예상 시간
  estimated_delivery_time Int?   // 배달 예상 소요 시간 (분)
  
  // 결제 정보
  payment_method  String?  // card
  payment_id      String?  // PortOne 결제 ID
  paid_at         DateTime?
  
  // 주문 확정
  confirm_token   String?  @unique // 주문 확정용 토큰
  confirmed_at    DateTime?
  
  // 시간 추적
  picked_up_at    DateTime?
  delivered_at    DateTime?
  cancelled_at    DateTime?
  cancel_reason   String?
  
  // 메모
  customer_memo   String?  // 고객メモ
  restaurant_memo String?  // 식당メモ
  
  user            User       @relation(fields: [user_id], references: [id])
  restaurant      Restaurant @relation(fields: [restaurant_id], references: [id])
  items           OrderItem[]
  
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  @@index([user_id])
  @@index([restaurant_id])
  @@index([status])
  @@index([order_number])
  @@index([confirm_token])
}

// ============================================
// OrderItems Table - 주문 메뉴 상세
// ============================================
model OrderItem {
  id          String  @id @default(uuid())
  order_id    String
  menu_id     String?
  
  menu_name   String  // 메뉴명 (변경 대비)
  quantity    Int
  unit_price  Int     // 단가
  subtotal    Int     // quantity * unit_price
  
  order       Order   @relation(fields: [order_id], references: [id], onDelete: Cascade)
  menu        Menu?   @relation(fields: [menu_id], references: [id])
  
  created_at  DateTime @default(now())

  @@index([order_id])
}

// ============================================
// Settings Table - 시스템 설정
// ============================================
model Setting {
  id          String   @id @default(uuid())
  key         String   @unique
  value       String   // JSON 문자열로 저장
  type        SettingType // business_hours, delivery, payment, etc.
  description String?
  
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@index([key, type])
}

// ============================================
// Enum Types
// ============================================
enum OrderStatus {
  pending     // 결제 완료, 확정 대기
  confirmed   // 고객 확정됨
  preparing   // 조리중 (식당에서 수락)
  picked_up   // 픽업됨
  delivering  // 배달중
  completed   // 배달 완료
  cancelled   // 취소됨
}

enum SettingType {
  business_hours  // 영업시간
  delivery       // 배달 설정
  payment        // 결제 설정
  sms            // SMS 설정
  general        // 일반 설정
}

// ============================================
// Indexes (추가 성능 최적화)
// ============================================
// Locations Table - 식당별 배달 가능 지역 캐시
model DeliveryZone {
  id            String   @id @default(uuid())
  restaurant_id String
  zone_name     String   // 지역명 (동/면 단위)
  latitude      Float
  longitude     Float
  radius_km     Float    // 배달 가능 반경
  
  is_active     Boolean  @default(true)
  
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@unique([restaurant_id, zone_name])
  @@index([restaurant_id])
}
```

---

## 4. API Endpoints

### 4.1 API Versioning

```
Base URL: /api/v1
```

### 4.2 Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| | **Auth** | | |
| POST | /auth/phone/request | 전화번호 인증 SMS 요청 | - |
| POST | /auth/phone/verify | 인증번호 검증 | - |
| POST | /auth/refresh | Refresh Token 갱신 | JWT |
| | **Users** | | |
| GET | /users/me | 내 정보 조회 | JWT |
| PUT | /users/me | 내 정보 수정 | JWT |
| GET | /users/orders | 내 주문 목록 | JWT |
| | **Restaurants** | | |
| GET | /restaurants | 배달 가능한 식당 목록 | - |
| GET | /restaurants/:id | 식당 상세 정보 | - |
| GET | /restaurants/:id/menus | 식당 메뉴 목록 | - |
| POST | /restaurants/sync | 식당 데이터 동기화 (Admin) | Admin |
| | **Orders** | | |
| POST | /orders | 주문 생성 (결제 전) | JWT |
| GET | /orders/:id | 주문 상세 조회 | JWT |
| PUT | /orders/:id/confirm | 주문 확정 | JWT |
| PUT | /orders/:id/cancel | 주문 취소 | JWT |
| GET | /orders/:id/status | 주문 상태 조회 | - |
| | **Payments** | | |
| POST | /payments/prepare | 결제 준비 | JWT |
| POST | /payments/complete | 결제 완료 처리 | Webhook |
| POST | /payments/cancel | 결제 취소 | JWT |
| | **Delivery** | | |
| GET | /delivery/fee | 배달비 계산 | - |
| GET | /delivery/estimate | 배달 예상 시간 조회 | - |
| | **Settings** | | |
| GET | /settings/business-hours | 영업시간 조회 | - |
| GET | /settings | 전체 설정 조회 | - |
| PUT | /settings | 설정 수정 (Admin) | Admin |
| | **Webhooks** | | |
| POST | /webhooks/sms | SMS 수신 webhook | - |
| POST | /webhooks/payment | 결제 webhook (PortOne) | - |
| POST | /webhooks/naver | 네이버 지도 데이터 동기화 | - |
| | **Admin** | | |
| GET | /admin/orders | 전체 주문 목록 | Admin |
| PUT | /admin/orders/:id/status | 주문 상태 변경 | Admin |
| GET | /admin/restaurants | 식당 관리 | Admin |
| PUT | /admin/restaurants/:id | 식당 정보 수정 | Admin |

### 4.3 Detailed API Specification

#### 4.3.1 Authentication

```yaml
# POST /api/v1/auth/phone/request
# 전화번호 인증 SMS 요청
Request:
  Body:
    phone: string (required) # 010-xxxx-xxxx

Response:
  200:
    success: true
    message: "인증번호가 전송되었습니다"
    expires_in: 180 # 3분

# POST /api/v1/auth/phone/verify
# 인증번호 검증 및 JWT 발급
Request:
  Body:
    phone: string (required)
    code: string (required) # 6자리

Response:
  200:
    success: true
    access_token: string
    refresh_token: string
    user:
      id: string
      phone: string
      name: string | null

# POST /api/v1/auth/refresh
# Refresh Token으로 Access Token 갱신
Request:
  Headers:
    Authorization: Bearer {refresh_token}

Response:
  200:
    success: true
    access_token: string
```

#### 4.3.2 Restaurants

```yaml
# GET /api/v1/restaurants
# 배달 가능한 식당 목록 조회
Query Parameters:
  lat: number (optional) # 사용자 위도
  lng: number (optional) # 사용자 경도
  category: string (optional)
  page: number (default: 1)
  limit: number (default: 20)
  only_open: boolean (default: true) # 영업중만

Response:
  200:
    success: true
    data:
      - id: string
        name: string
        address: string
        latitude: float
        longitude: float
        category: string
        rating: float
        distance: float | null # km (lat/lng 제공 시)
        is_open: boolean
        delivery_fee: integer
        estimated_time: integer # 분
    pagination:
      page: number
      limit: number
      total: number
      total_pages: number

# GET /api/v1/restaurants/:id
# 식당 상세 정보
Response:
  200:
    success: true
    data:
      id: string
      name: string
      address: string
      phone: string
      latitude: float
      longitude: float
      category: string
      rating: float
      is_open: boolean
      business_hours: string # "10:00-22:00"
      delivery_fee: integer
      delivery_radius: float
      image_url: string

# GET /api/v1/restaurants/:id/menus
# 식당 메뉴 목록
Query Parameters:
  available_only: boolean (default: true)

Response:
  200:
    success: true
    data:
      - id: string
        name: string
        description: string
        price: integer
        image_url: string
        is_available: boolean
```

#### 4.3.3 Orders

```yaml
# POST /api/v1/orders
# 주문 생성 (결제 전)
Request:
  Headers:
    Authorization: Bearer {access_token}
  Body:
    restaurant_id: string (required)
    items:
      - menu_id: string
        quantity: number
    delivery_address: string
    delivery_latitude: float
    delivery_longitude: float
    customer_memo: string (optional)

Response:
  200:
    success: true
    data:
      order_id: string
      order_number: string
      subtotal: integer
      delivery_fee: integer
      total_amount: integer
      estimated_delivery_time: integer
      payment_prepare_data: object # PortOne 결제 준비 데이터

# GET /api/v1/orders/:id
# 주문 상세 조회
Response:
  200:
    success: true
    data:
      id: string
      order_number: string
      status: enum
      restaurant:
        id: string
        name: string
      items:
        - menu_name: string
          quantity: number
          unit_price: integer
          subtotal: integer
      subtotal: integer
      delivery_fee: integer
      total_amount: integer
      delivery_address: string
      estimated_delivery_time: integer
      status_timeline:
        paid_at: datetime
        confirmed_at: datetime | null
        picked_up_at: datetime | null
        delivered_at: datetime | null

# PUT /api/v1/orders/:id/confirm
# 주문 확정
Request:
  Headers:
    Authorization: Bearer {access_token}

Response:
  200:
    success: true
    message: "주문이 확정되었습니다"
    data:
      estimated_delivery_time: integer

# PUT /api/v1/orders/:id/cancel
# 주문 취소
Request:
  Headers:
    Authorization: Bearer {access_token}
  Body:
    reason: string (optional)

Response:
  200:
    success: true
    message: "주문이 취소되었습니다"
    refund_status: "completed" | "pending"

# GET /api/v1/orders/:id/status
# 주문 상태 조회 (비인증)
Query Parameters:
  phone: string (required) # 주문 시 사용한 전화번호

Response:
  200:
    success: true
    data:
      order_number: string
      status: enum
      status_text: string
      estimated_delivery_time: integer | null
```

#### 4.3.4 Payments

```yaml
# POST /api/v1/payments/prepare
# 결제 준비 (PortOne)
Request:
  Headers:
    Authorization: Bearer {access_token}
  Body:
    order_id: string
    amount: integer

Response:
  200:
    success: true
    data:
      payment_id: string # PortOne 결제 ID
      checkout_url: string # 카드사 이동 URL

# POST /api/v1/payments/complete
# 결제 완료 처리 (Webhook에서 호출)
Request:
  Body:
    imp_uid: string
    merchant_uid: string
    status: string
    amount: integer

Response:
  200:
    success: true

# POST /api/v1/payments/cancel
# 결제 취소 (환불)
Request:
  Headers:
    Authorization: Bearer {access_token}
  Body:
    order_id: string
    reason: string

Response:
  200:
    success: true
    cancel_id: string
    canceled_amount: integer
```

#### 4.3.5 Delivery

```yaml
# GET /api/v1/delivery/fee
# 배달비 계산
Query Parameters:
  restaurant_id: string (required)
  lat: float (required) # 목적지 위도
  lng: float (required) # 목적지 경도

Response:
  200:
    success: true
    data:
      distance: float # km
      base_fee: integer # 기본 배달비
      distance_fee: integer # 거리 추가 요금
      total_fee: integer # 총 배달비
      is_deliverable: boolean

# GET /api/v1/delivery/estimate
# 배달 예상 시간 조회
Query Parameters:
  restaurant_id: string (required)
  lat: float (required)
  lng: float (required)

Response:
  200:
    success: true
    data:
      estimated_pickup_time: integer # 픽업까지 예상 시간 (분)
      estimated_delivery_time: integer # 배달까지 예상 시간 (분)
      total_time: integer # 총 예상 시간 (분)
```

#### 4.3.6 Settings

```yaml
# GET /api/v1/settings/business-hours
# 영업시간 조회
Response:
  200:
    success: true
    data:
      is_open: boolean
      open_time: string # "09:00"
      close_time: string # "22:00"
      closed_days: string[] # ["sunday"]
      message: string # 영업 종료 시 메시지

# GET /api/v1/settings
# 전체 설정 조회 (Public)
Response:
  200:
    success: true
    data:
      business_hours: object
      delivery: object
      contact: object
```

#### 4.3.7 Webhooks

```yaml
# POST /api/v1/webhooks/sms
# SMS 수신 webhook (알리고)
Request:
  Body:
    type: string # SMS
    from: string # 발신번호
    content: string # 수신 내용
    timestamp: datetime

Response:
  200: OK (ACSII 200)

# POST /api/v1/webhooks/payment
# 결제 webhook (PortOne)
Request:
  Body:
    imp_uid: string
    merchant_uid: string
    status: string
    amount: integer

Response:
  200: OK

# POST /api/v1/webhooks/naver
# 네이버 지도 데이터 동기화 (Cron or Manual)
Request:
  Headers:
    X-Naver-Client-Secret: string
  Body:
    places: object[]

Response:
  200:
    success: true
    synced: number
```

---

## 5. 핵심 Business Logic

### 5.1 전화 수신 → SMS 발송 Flow

```
1. 알리고 SMS 수신 webhook 호출
   POST /webhooks/sms
   { from: "010xxxxxxx", content: "" }

2. 발신번호로 사용자 조회/생성
   - Users 테이블에서 phone 검색
   - 없으면 새 사용자 생성

3. 현재 영업시간 확인
   - Settings에서 business_hours 조회
   - 시간대별 is_open 판단

4. SMS 발송
   -营业中: https://hkd.app/r/{unique_token}
   -营业종료: https://hkd.app/closed

5. unique_token = JWT(phone, expires: 10min)
```

### 5.2 배달비 계산 (Haversine Formula)

```typescript
// src/utils/haversine.ts

interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * 두 지점 간 거리를 km 단위로 계산
 * Haversine Formula 사용
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371; // 지구 반지름 (km)
  
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * 배달비 계산
 * - 기본 배달비 (2km 이내)
 * - 2km 초과 시 km당 추가 요금
 */
export function calculateDeliveryFee(
  distance: number,
  baseFee: number = 3000,
  perKmFee: number = 500,
  maxDistance: number = 5.0
): { fee: number; isDeliverable: boolean } {
  // 배달 불가区域
  if (distance > maxDistance) {
    return { fee: 0, isDeliverable: false };
  }
  
  let fee = baseFee;
  
  // 2km 초과분만 추가 요금
  if (distance > 2.0) {
    const extraKm = Math.ceil(distance - 2.0);
    fee += extraKm * perKmFee;
  }
  
  return { fee, isDeliverable: true };
}

/**
 * 배달 예상 시간 계산
 * - 픽업 시간: 식당 조리 시간 (평균 20분)
 * - 배달 시간: 거리 기반 (평균 30km/h)
 */
export function estimateDeliveryTime(
  distance: number,
  cookingTimeMinutes: number = 20,
  averageSpeedKmh: number = 30
): {
  pickupTime: number;
  deliveryTime: number;
  totalTime: number;
} {
  const deliveryTimeMinutes = Math.ceil((distance / averageSpeedKmh) * 60);
  
  return {
    pickupTime: cookingTimeMinutes,
    deliveryTime: deliveryTimeMinutes,
    totalTime: cookingTimeMinutes + deliveryTimeMinutes
  };
}
```

### 5.3 영업시간 체크

```typescript
// src/services/BusinessHoursService.ts

interface BusinessHours {
  openTime: string;  // "09:00"
  closeTime: string; // "22:00"
  closedDays: string[]; // ["sunday"]
  isHoliday: boolean;
  holidayMessage?: string;
}

export function checkBusinessStatus(settings: BusinessHours): {
  isOpen: boolean;
  message?: string;
  redirectUrl?: string;
} {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
  
  // 휴일 체크
  if (settings.isHoliday) {
    return {
      isOpen: false,
      message: settings.holidayMessage || '오늘은 휴일입니다.',
      redirectUrl: '/closed'
    };
  }
  
  // 정기 휴일 체크
  if (settings.closedDays.includes(dayOfWeek)) {
    return {
      isOpen: false,
      message: `매주 ${getDayNameKo(dayOfWeek)}은 휴일입니다.`,
      redirectUrl: '/closed'
    };
  }
  
  // 시간대 체크
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMin] = settings.openTime.split(':').map(Number);
  const [closeHour, closeMin] = settings.closeTime.split(':').map(Number);
  
  const openTimeMinutes = openHour * 60 + openMin;
  const closeTimeMinutes = closeHour * 60 + closeMin;
  
  if (currentTime < openTimeMinutes || currentTime >= closeTimeMinutes) {
    return {
      isOpen: false,
      message: `영업시간은 ${settings.openTime} ~ ${settings.closeTime}입니다.`,
      redirectUrl: '/closed'
    };
  }
  
  return { isOpen: true };
}

function getDayNameKo(day: string): string {
  const map: Record<string, string> = {
    'sunday': '일요일',
    'monday': '월요일',
    'tuesday': '화요일',
    'wednesday': '수요일',
    'thursday': '목요일',
    'friday': '금요일',
    'saturday': '토요일'
  };
  return map[day] || day;
}
```

### 5.4 주문 상태 관리

```typescript
// 주문 상태 전이

type OrderStatus = 
  | 'pending'    // 결제 완료, 확정 대기
  | 'confirmed'  // 고객 확정됨
  | 'preparing'  // 조리중
  | 'picked_up'  // 픽업됨
  | 'delivering' // 배달중
  | 'completed'  // 완료
  | 'cancelled'; // 취소

// 유효한 상태 전이
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['picked_up', 'cancelled'],
  picked_up: ['delivering', 'cancelled'],
  delivering: ['completed'],
  completed: [],
  cancelled: []
};

export function canTransitionTo(current: OrderStatus, next: OrderStatus): boolean {
  return validTransitions[current]?.includes(next) ?? false;
}
```

---

## 6. 설정 데이터 (Settings Table)

```sql
-- Business Hours 설정
INSERT INTO settings (key, value, type, description) VALUES
('business_hours', 
 '{"openTime": "09:00", "closeTime": "22:00", "closedDays": ["sunday"], "isHoliday": false}',
 'business_hours', 
 '영업시간 설정');

-- Delivery 설정
INSERT INTO settings (key, value, type, description) VALUES
('delivery_config',
 '{"baseFee": 3000, "perKmFee": 500, "maxDistance": 5.0, "freeDeliveryThreshold": 30000, "averageSpeedKmh": 30, "cookingTimeMinutes": 20}',
 'delivery',
 '배달비 설정');

-- Payment 설정
INSERT INTO settings (key, value, type, description) VALUES
('payment_config',
 '{"pg": "kakaopay", "currency": "KRW", "language": "ko"}',
 'payment',
 '결제 설정');

-- SMS 설정
INSERT INTO settings (key, value, type, description) VALUES
('sms_config',
 '{"aligo": {"sender": "02-xxxx-xxxx", "template_id": "order_confirm"}}',
 'sms',
 'SMS 설정');
```

---

## 7. 폴더 구조 (최종)

```
/hangkyeong-delivery
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   └── env.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── auth.routes.ts
│   │   │   ├── user/
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   └── user.routes.ts
│   │   │   ├── restaurant/
│   │   │   │   ├── restaurant.controller.ts
│   │   │   │   ├── restaurant.service.ts
│   │   │   │   └── restaurant.routes.ts
│   │   │   ├── order/
│   │   │   │   ├── order.controller.ts
│   │   │   │   ├── order.service.ts
│   │   │   │   └── order.routes.ts
│   │   │   ├── payment/
│   │   │   │   ├── payment.controller.ts
│   │   │   │   ├── payment.service.ts
│   │   │   │   └── payment.routes.ts
│   │   │   └── admin/
│   │   │       ├── admin.controller.ts
│   │   │       ├── admin.service.ts
│   │   │       └── admin.routes.ts
│   │   ├── services/
│   │   │   ├── BusinessHoursService.ts
│   │   │   ├── DeliveryFeeCalculator.ts
│   │   │   ├── NaverMapService.ts
│   │   │   ├── SMSService.ts
│   │   │   └── PaymentService.ts
│   │   ├── utils/
│   │   │   ├── haversine.ts
│   │   │   ├── jwt.ts
│   │   │   └── validators.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── admin.middleware.ts
│   │   │   └── errorHandler.middleware.ts
│   │   ├── hooks/
│   │   │   ├── sms.webhook.ts
│   │   │   ├── payment.webhook.ts
│   │   │   └── naverSync.webhook.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── restaurants/
│   │   │   ├── menu/[restaurantId]/
│   │   │   ├── cart/
│   │   │   ├── order/[orderId]/
│   │   │   ├── confirm/[token]/
│   │   │   ├── closed/
│   │   │   └── api/
│   │   │       └── [...route]/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── types/
│   │   └── utils/
│   ├── public/
│   ├── package.json
│   └── next.config.js
│
└── README.md
```

---

## 8. 구현 우선순위

### Phase 1 (MVP - 2주)
1. ✅ DB 스키마 설계 및 마이그레이션
2. ✅ 전화 수신 → SMS 발송 (알리고 연동)
3. ✅ 영업시간 체크 및 페이지 분기
4. ✅ 식당 목록 조회 (Mock 데이터)
5. ✅ 주문 생성 및 상태 관리

### Phase 2 (1주)
1. 🚀 네이버 지도 API 연동 (식당 데이터)
2. 🚀 배달비 계산 (Haversine)
3. 🚀 카드 결제 (PortOne)

### Phase 3 (1주)
1. 📦 관리자 페이지
2. 📦 주문 알림 (SMS)
3. 📦 실시간 상태 업데이트

---

## 9. 참고 사항

### 9.1 외부 API 연동

| Service | API | 용도 |
|---------|-----|------|
| 알리고 | SMS API | 전화 수신 감지, SMS 발송 |
| 네이버 지도 | Places API | 식당 검색, 영업상태 |
| 네이버 지도 | Map API | 좌표 변환, 경로 |
| PortOne | 결제 API | 카드 결제, 취소 |
| PortOne | 정산 API | 월별 정산 |

### 9.2 보안 고려사항

1. **전화번호 인증**: SMS 인증번호 6자리, 3분 유효
2. **주문 확정**: Confirm Token (JWT, 10분 유효)
3. **결제**: PortOne PG 연동, 실결제而非 테스트
4. **Rate Limiting**: IP별 요청 제한 (SMS滥用防止)

### 9.3 확장성 고려

1. **Cache**: Redis를 활용한 식당 데이터 캐싱
2. **Queue**: BullMQ를 활용한 비동기 작업 (SMS 발송, 결제 처리)
3. **WebSocket**: 실시간 주문 상태 업데이트
