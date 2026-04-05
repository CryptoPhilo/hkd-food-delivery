# HKD 고객 페이지 다국어화(i18n) 계획서

> 작성일: 2026-04-04 (최종 수정: 2026-04-04)
> 구현 완료일: 2026-04-04
> 대상: 고객 페이지 + 고객 SMS + 결제창 + 국제 전화번호 + 관리자/배달원 언어 표시
> 지원 언어: 한국어(ko), 영어(en), 일본어(ja), 중국어(zh), 프랑스어(fr), 독일어(de), 스페인어(es)
> 상태: ✅ 전체 구현 완료

---

## 1. 현황 분석

### 1.1 현재 상태

현재 프론트엔드는 **모든 UI 문자열이 한국어로 하드코딩**되어 있으며, i18n 라이브러리가 전혀 도입되지 않은 상태이다.

| 항목 | 현재 값 |
|------|---------|
| 프레임워크 | Next.js 14.2.3 (App Router) |
| 렌더링 방식 | Client Components (`'use client'`) 위주 |
| i18n 라이브러리 | 없음 |
| HTML lang 속성 | `ko` 고정 |
| 하드코딩 한국어 문자열 | **150개 이상** (고객 페이지 기준) |
| SMS 템플릿 | Naver Cloud SENS API, **12개 템플릿** 전부 한국어 |
| 결제 SDK | PortOne V2 Browser SDK, locale 미설정 (기본 KO_KR) |
| 전화번호 입력 | 한국 번호 전용 (`/^01[016789]\d{7,8}$/`), 국가코드 미지원 |
| 관리자/배달원 | 주문 상세에 고객 언어 정보 미표시 |

### 1.2 고객 페이지 목록 및 문자열 수

| 페이지 | 경로 | 하드코딩 문자열 수 |
|--------|------|:------------------:|
| 홈 (식당/편의점 목록) | `/` (`page.tsx`) | ~35 |
| 식당 상세 | `/restaurant/[id]` | ~20 |
| 편의점 상세 | `/store/[id]` | ~25 |
| 결제 | `/checkout` | **~55** ⚠️ |
| 결제 완료 | `/checkout/complete` | ~18 |
| 내 주문 조회 | `/my-orders` | ~18 |
| 주문 상세/추적 | `/order/[id]` | ~15 |
| 주문 확인 (토큰) | `/confirm/[token]` | **~11** ⚠️ |
| 주문 취소 (토큰) | `/cancel/[token]` | **~12** ⚠️ |
| 공통 레이아웃 (footer) | `layout.tsx` | ~8 |
| 유틸리티 | `utils/thumbnail.ts` | **~20** ⚠️ |
| 백엔드 API 응답 | `order.routes.ts`, `payment.routes.ts` | **~18** ⚠️ |
| **합계** | | **~255** |

> ⚠️ 초기 분석 대비 대폭 증가한 페이지. 코드베이스 전수 조사 결과 반영 (2026-04-04).

### 1.3 문자열 카테고리 분류

| 카테고리 | 예시 | 수량 |
|----------|------|:----:|
| 네비게이션/UI 라벨 | 장바구니, 내주문, 메뉴, 식당/편의점 탭 | ~20 |
| 상태 메시지 | 위치를 확인하는 중..., 조회중... | ~15 |
| 주문/결제 흐름 | 배달 주소, 주문 완료, 결제 실패 | ~25 |
| 식당/상점 정보 | 영업시간, 배달 가능, 품절 | ~20 |
| 에러 메시지 | 식당을 찾을 수 없습니다, 주소를 찾을 수 없습니다 | ~30 |
| 카테고리명 | 치킨, 카페, 중식, 음료, 과자/스낵 등 | ~20 |
| 주문 상태 | 주문 요청됨, 확인 대기중, 배달 중, 완료 | ~8 |
| 단위/포맷 | {n}개, 약 {n}분, {n}곳 배달가능, 원 | ~15 |
| 법적/회사 정보 | 이용약관, 개인정보처리방침, 사업자 정보 | ~8 |
| 결제 폼 라벨 | 고객 정보, 전화번호, 이름, 배달 정보, 메모, 결제 수단 | ~25 |
| 주문 확인/취소 결과 | 주문이 확정되었습니다, 환불 금액, 환불 상태 | ~20 |
| alert() 다이얼로그 | 장바구니가 비어있습니다, 결제 모듈 로딩 실패 등 | ~16 |
| 썸네일 카테고리 매핑 | 한식, 중식, 양식, 치킨 + regex 패턴 | ~20 |
| 백엔드 API 에러 | paymentId와 amount는 필수입니다, 전화번호가 필요합니다 | ~18 |

### 1.4 SMS 템플릿 현황 분석

백엔드 `SMSService.ts`, `admin.routes.ts`, `auth.routes.ts`, `webhook.routes.ts`에 걸쳐 **12개 SMS 템플릿**이 한국어로 하드코딩되어 있다.

| ID | 템플릿 | 발송 시점 | 파일 |
|----|--------|-----------|------|
| SMS-01 | 주문 요청 알림 | 주문 생성 직후 | `SMSService.ts` |
| SMS-02 | 주문 확정/취소 링크 | 픽업 시간 확인 요청 | `SMSService.ts` |
| SMS-03 | 주문 확정 완료 | 고객이 확정 클릭 후 | `SMSService.ts` |
| SMS-04 | 주문 취소 완료 | 고객이 취소 클릭 후 | `SMSService.ts` |
| SMS-05 | 픽업 완료/배달 시작 | 배달원 픽업 완료 시 | `SMSService.ts` |
| SMS-06 | 배달 완료 | 배달 완료 처리 시 | `SMSService.ts` |
| SMS-07 | 픽업 시간 알림 | 픽업 시간 확정 시 | `SMSService.ts` |
| SMS-08 | 배달원 배정 알림 | 관리자가 배달원 배정 시 | `admin.routes.ts` |
| SMS-09 | 픽업 출발 알림 | 배달원 출발 시 | `admin.routes.ts` |
| SMS-10 | 배달 중 알림 | 배달 시작 시 | `admin.routes.ts` |
| SMS-11 | 성인 인증번호 | 주류 주문 인증 시 | `SMSService.ts` |
| SMS-12 | 주문 링크 (웹훅) | ARS 수신 → SMS 발송 | `webhook.routes.ts` |

**SMS 문자열 예시 (다국어화 후):**
```
[HKD] Your order has been placed.
Order #: {orderNumber}
Restaurant: {restaurantName}
Items: {items}
Delivery fee: ₩{deliveryFee}
Total: ₩{totalAmount}
Est. delivery: ~{estimatedTime} min
```
> 통화 기호는 전 언어 `₩`(KRW)로 통일.

### 1.5 결제창 (PortOne V2) 다국어 지원 현황

현재 결제 호출 코드(`checkout/page.tsx`)에 `locale` 파라미터가 **설정되지 않아** 기본값인 한국어(`KO_KR`)로만 표시된다.

**PortOne V2 SDK 지원 locale:**

| locale 코드 | 언어 | PG사별 지원 |
|-------------|------|-------------|
| `KO_KR` | 한국어 | KG이니시스, 스마트로, KSNET, 웰컴페이먼츠, 한국결제네트웍스, 엑심베이 |
| `EN_US` | 영어 | KG이니시스, 스마트로, KSNET, 웰컴페이먼츠, 한국결제네트웍스, 엑심베이 |
| `ZH_CN` | 중국어(간체) | KG이니시스(PC), 웰컴페이먼츠(PC), 엑심베이 |
| `JA_JP` | 일본어 | 엑심베이 |
| `FR_FR` | 프랑스어 | Triple-A |
| `DE_DE` | 독일어 | Triple-A |
| `ES_ES` | 스페인어 | Triple-A |

**HKD 지원 언어 ↔ PortOne locale 매핑:**

| HKD locale | PortOne locale | 결제창 지원 여부 | 폴백 전략 |
|:----------:|:--------------:|:----------------:|-----------|
| `ko` | `KO_KR` | ✅ 모든 PG | — |
| `en` | `EN_US` | ✅ 모든 PG | — |
| `zh` | `ZH_CN` | ⚠️ 일부 PG (PC만) | KG이니시스/웰컴 → ZH_CN, 그 외 → EN_US |
| `ja` | `JA_JP` | ⚠️ 엑심베이만 | 엑심베이 → JA_JP, 그 외 → EN_US |
| `fr` | `FR_FR` | ⚠️ Triple-A만 | Triple-A → FR_FR, 그 외 → EN_US |
| `de` | `DE_DE` | ⚠️ Triple-A만 | Triple-A → DE_DE, 그 외 → EN_US |
| `es` | `ES_ES` | ⚠️ Triple-A만 | Triple-A → ES_ES, 그 외 → EN_US |

> **참고**: 현재 HKD가 사용하는 PG사에 따라 실제 지원되는 언어가 달라진다. 지원되지 않는 locale을 넘기면 PortOne SDK가 자동으로 `KO_KR`로 폴백하므로, 명시적으로 `EN_US`로 폴백하는 로직이 필요하다.

### 1.6 전화번호 입력 현황

현재 전화번호 입력은 **한국 번호만** 허용하는 구조이다.

| 항목 | 현재 상태 |
|------|-----------|
| 입력 필드 | `<input type="tel">`, placeholder: `010-1234-5678` |
| 검증 정규식 | `/^01[016789]\d{7,8}$/` (한국 휴대폰만) |
| 국가코드 | 미지원 (010 등 한국 내수 번호만) |
| DB 저장 형식 | `01012345678` (11자리, 하이픈 제거) |
| 사용 위치 | 결제(`checkout`), 주문 조회(`my-orders`), 배달원(`driver`) |

**변경 필요 사항**:
- 국가코드 선택 드롭다운 추가 (기본값: locale에 따라 자동 선택)
- 한국어 사용자: 기본 +82, 다른 국가코드 선택 가능
- 외국어 사용자: 해당 언어의 대표 국가코드 기본 선택
- DB 저장 형식을 E.164 국제 표준(`+821012345678`)으로 변경
- 백엔드 검증 로직 국제 번호 대응

### 1.7 관리자/배달원 페이지 고객 언어 표시 현황

현재 관리자와 배달원 페이지에서 **고객의 언어 설정 정보가 전혀 표시되지 않는다**.

**관리자 페이지 (`admin/orders/`):**
- 주문 목록: 고객명, 전화번호, 식당명, 주문 상태 표시
- 주문 상세: 고객명, 전화번호, 배달주소, 식당 정보 표시
- 고객 언어 정보 **없음**

**배달원 페이지 (`driver/`):**
- 배정 주문: customerName, customerPhone, customerMemo 표시
- 대기 주문: customerPhone, customerMemo 표시
- 고객 언어 정보 **없음**

**변경 필요 사항**:
- 주문 데이터에 `locale` 필드를 포함하여 관리자/배달원에게 전달
- 언어 배지(예: 🇺🇸 EN, 🇯🇵 JA) 형태로 주문 카드에 표시
- 외국어 고객 주문 시 시각적으로 구분 가능하도록 하이라이트

---

## 2. 기술 설계

### 2.1 라이브러리 선택: `next-intl`

| 후보 | 장점 | 단점 | 채택 여부 |
|------|------|------|:---------:|
| **next-intl** | App Router 네이티브 지원, 서버/클라이언트 컴포넌트 모두 지원, 경량, 활발한 유지보수 | 상대적으로 신규 | ✅ 채택 |
| next-i18next | 높은 점유율, 풍부한 문서 | Pages Router 중심, App Router 지원 미흡 | ❌ |
| react-intl | ICU 메시지 포맷 완벽 지원 | Next.js 전용 아님, 설정 복잡 | ❌ |
| 자체 구현 | 의존성 없음 | 유지보수 부담, 복수형/날짜 처리 직접 구현 필요 | ❌ |

**선정 이유**: `next-intl`은 Next.js 14 App Router를 1급으로 지원하며, Client Component에서의 사용이 간단하다. 현재 프로젝트가 `'use client'` 컴포넌트 위주이므로 가장 적합하다.

### 2.2 라우팅 전략: 미들웨어 기반 언어 감지 (URL 경로 없음)

사용자의 **브라우저/시스템 언어 설정(Accept-Language 헤더)**을 감지하여 적절한 언어를 제공한다. URL에 locale prefix를 추가하지 않는다.

```
현재: /restaurant/123
변경 후: /restaurant/123  (동일 — URL 변경 없음)
```

**이유**:
- 배달 앱 특성상 URL을 직접 입력하는 경우가 드물고, SMS 링크를 통해 접속함
- URL 구조 변경 시 기존 SMS 링크 호환성 문제 발생
- 쿠키 기반으로 사용자 선택 언어를 기억

### 2.3 언어 감지 우선순위

```
1. 쿠키에 저장된 사용자 선택 언어 (NEXT_LOCALE)
2. Accept-Language 헤더 (브라우저/시스템 언어)
3. 기본값: 영어(en)
```

### 2.4 디렉토리 구조

```
src/
├── i18n/
│   ├── config.ts              # 지원 언어 목록, 기본 언어 설정
│   ├── request.ts             # next-intl의 getRequestConfig
│   └── messages/
│       ├── ko.json            # 한국어 (원본)
│       ├── en.json            # 영어 (기본 폴백)
│       ├── ja.json            # 일본어
│       ├── zh.json            # 중국어 (간체)
│       ├── fr.json            # 프랑스어
│       ├── de.json            # 독일어
│       └── es.json            # 스페인어
├── components/
│   └── LanguageSwitcher.tsx   # 언어 선택 UI 컴포넌트
├── middleware.ts               # 언어 감지 미들웨어
└── app/
    └── ... (기존 구조 유지)
```

### 2.5 번역 키 네이밍 컨벤션

**구조**: `{페이지}.{섹션}.{요소}` (최대 3단계 중첩)

```json
{
  "common": {
    "loading": "로딩 중...",
    "error": "오류가 발생했습니다",
    "retry": "다시 시도",
    "backToMain": "메인으로 돌아가기",
    "cart": "장바구니",
    "myOrders": "내 주문"
  },
  "home": {
    "title": "한경배달",
    "tabs": {
      "restaurant": "식당",
      "convenienceStore": "편의점"
    },
    "status": {
      "detectingLocation": "위치를 확인하는 중...",
      "loadingInfo": "정보를 불러오는 중..."
    }
  },
  "order": {
    "status": {
      "pending": "주문 요청됨",
      "pendingConfirmation": "확인 대기중",
      "confirmed": "주문 확정",
      "pickedUp": "픽업 완료",
      "delivering": "배달 중",
      "completed": "배달 완료",
      "cancelled": "주문 취소"
    }
  }
}
```

---

## 3. 번역 파일 전체 구조

아래는 `ko.json`의 전체 키 구조이다. 각 언어 파일은 동일한 구조를 가진다.

```jsonc
{
  // ── 공통 ──
  "common": {
    "loading": "로딩 중...",
    "error": "오류가 발생했습니다",
    "retry": "다시 시도",
    "backToMain": "메인으로 돌아가기",
    "cart": "장바구니",
    "viewCart": "장바구니 보기",
    "myOrders": "내 주문",
    "notDeliveryTime": "배달 가능한 시간이 아닙니다",
    "closedToday": "오늘은 정기 휴무일입니다",
    "businessHours": "영업시간: {hours}",
    "businessHoursNotSet": "영업시간 미설정",
    "open24h": "24시간 영업",
    "badge24h": "24H",
    "recommended": "추천",
    "preparing": "준비중",
    "count": "{n}개",
    "deliveryAvailable": "{n}곳 배달가능"
  },

  // ── 홈 페이지 ──
  "home": {
    "title": "한경배달",
    "description": "제주 한경면 음식배달 서비스",
    "tabs": {
      "restaurant": "🍽️ 식당",
      "convenienceStore": "🏪 편의점"
    },
    "status": {
      "detectingLocation": "위치를 확인하는 중...",
      "loadingInfo": "정보를 불러오는 중..."
    },
    "empty": {
      "noRestaurants": "현재 배달 가능한 식당이 없습니다.",
      "noStores": "현재 배달 가능한 편의점이 없습니다."
    },
    "category": {
      "other": "기타",
      "otherStore": "기타 편의점"
    }
  },

  // ── 식당 상세 ──
  "restaurant": {
    "notFound": "식당을 찾을 수 없습니다.",
    "categoryFallback": "음식점",
    "menu": "메뉴",
    "noMenus": "현재 주문 가능한 메뉴가 없습니다.",
    "addToCart": "담기",
    "notAccepting": "{name}님은 현재 주문 접수가 불가합니다."
  },

  // ── 편의점 상세 ──
  "store": {
    "categories": {
      "all": "전체",
      "drinks": "음료",
      "snacks": "과자/스낵",
      "meals": "도시락/간편식",
      "dairy": "유제품",
      "noodles": "라면/면류",
      "bakery": "빵/베이커리",
      "iceCream": "아이스크림",
      "daily": "생활용품",
      "alcohol": "주류"
    },
    "outOfStock": "품절된 상품입니다.",
    "noProducts": "현재 주문 가능한 상품이 없습니다.",
    "noCategoryProducts": "해당 카테고리에 상품이 없습니다."
  },

  // ── 결제 ──
  "checkout": {
    "title": "주문하기",
    "customerInfo": "고객 정보",
    "phoneLabel": "전화번호",
    "nameLabel": "이름 (선택)",
    "namePlaceholder": "홍길동",
    "deliveryInfo": "배달 정보",
    "deliveryAddress": "배달 주소",
    "addressPlaceholder": "제주특별자치도 제주시 한경면...",
    "addressMinLength": "배달 주소를 먼저 입력해주세요 (최소 5자).",
    "addressNotFound": "주소를 찾을 수 없습니다. 좀 더 정확한 주소를 입력해주세요.",
    "distanceError": "거리 계산 중 오류가 발생했습니다.",
    "memoLabel": "메모 (선택)",
    "memoPlaceholder": "배송 시 요청사항",
    "paymentMethod": "결제 수단",
    "creditCard": "신용카드 / 체크카드",
    "foodAmount": "음식 금액",
    "deliveryFee": "배달비",
    "additionalFee": "(추가)",
    "distanceSurcharge": "거리 할증 ({distance}까지 {km}km)",
    "distanceSurchargeLabel": "거리 할증",
    "distanceSurchargePlaceholder": "----",
    "totalAmount": "총액",
    "currencySymbol": "₩",
    "continueOrdering": "+ 계속 주문하기",
    "emptyCart": "장바구니가 비어있습니다.",
    "goToMenu": "메뉴 보러가기",
    "delete": "삭제",
    "calculating": "계산 중...",
    "recalculate": "거리할증 재계산",
    "calculateDeliveryFee": "거리할증 배달비 계산",
    "payButton": "₩{amount} 결제하기",
    "payProcessing": "결제 처리중...",
    "payModuleLoading": "결제 모듈 로딩중...",
    "adultVerificationTitle": "성인 인증 상품 포함",
    "adultVerificationMessage": "주문에 성인 인증이 필요한 상품이 포함되어 있습니다. 배달 시 신분증 확인이 필요할 수 있습니다.",
    "notDeliveryTimeTitle": "배달 가능한 시간이 아닙니다",
    "notDeliveryTimeMessage": "한경배달 플랫폼의 운영 시간이 아닙니다. 운영 시간에 다시 이용해주세요.",
    "alert": {
      "enterPhoneAndAddress": "전화번호와 배달 주소를 입력해주세요.",
      "calculateFirst": "배달 주소 입력 후 \"거리할증 배달비 계산\" 버튼을 눌러주세요.",
      "emptyCart": "장바구니가 비어있습니다.",
      "moduleLoading": "결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.",
      "moduleLoadFailed": "결제 모듈 로드에 실패했습니다. 페이지를 새로고침해주세요.",
      "paymentCancelled": "결제가 취소되었습니다.",
      "paymentError": "결제 오류: {errMsg}\n\ncode: {errCode}",
      "paymentException": "결제 중 오류가 발생했습니다: {error}",
      "verifyFailed": "결제 검증에 실패했습니다: {error}",
      "orderFailedRefund": "주문 실패로 결제가 자동 취소되었습니다.\n사유: {error}",
      "orderSuccess": "결제 및 주문이 완료되었습니다!",
      "orderErrorRefund": "주문 중 오류가 발생하여 결제가 자동 취소되었습니다: {error}"
    }
  },

  // ── 결제 완료 ──
  "checkoutComplete": {
    "verifying": "결제 확인 중...",
    "orderComplete": "주문 완료",
    "paymentAndOrderComplete": "결제 및 주문이 완료되었습니다!",
    "paymentFailed": "결제 실패",
    "paymentCancelled": "결제가 취소되었습니다.",
    "paymentFailedGeneric": "결제에 실패했습니다.",
    "paymentInfoNotFound": "결제 정보를 찾을 수 없습니다.",
    "cartNotFound": "장바구니 데이터를 찾을 수 없습니다.",
    "amountNotFound": "결제 금액 정보를 찾을 수 없습니다.",
    "phoneNotFound": "고객 전화번호 정보를 찾을 수 없습니다. 다시 주문해주세요.",
    "verifyFailed": "결제 검증에 실패했습니다: {error}",
    "orderCreationFailed": "주문 생성 실패로 결제가 자동 취소되었습니다.\n사유: {reason}",
    "orderCreationError": "주문 생성에 실패했습니다.",
    "orderProcessingError": "주문 처리 중 오류: {error}"
  },

  // ── 주문 확인 (토큰) ──
  "confirm": {
    "loading": "주문을 확정하고 있습니다...",
    "failTitle": "주문 확정 실패",
    "invalidAccess": "잘못된 접근입니다.",
    "goToMain": "메인으로 이동",
    "successTitle": "주문이 확정되었습니다!",
    "orderNumber": "주문번호:",
    "estimatedDelivery": "예상 배달 시간",
    "orderStatus": "주문 상태",
    "confirmed": "확정됨",
    "viewOrderStatus": "주문 현황 보기",
    "processingError": "주문 확정 처리 중 오류가 발생했습니다."
  },

  // ── 주문 취소 (토큰) ──
  "cancel": {
    "loading": "주문을 취소하고 환불을 처리하고 있습니다...",
    "failTitle": "주문 취소 실패",
    "invalidAccess": "잘못된 접근입니다.",
    "goToMain": "메인으로 이동",
    "successTitle": "주문이 취소되었습니다",
    "orderNumber": "주문번호:",
    "refundAmount": "환불 금액",
    "refundStatus": "환불 상태",
    "refundProcessing": "처리중 (3~5일 소요)",
    "refundNotice": "환불은 카드사에 따라 3~5영업일 이내에 처리됩니다.",
    "processingError": "주문 취소 처리 중 오류가 발생했습니다."
  },

  // ── 내 주문 ──
  "myOrders": {
    "title": "내 주문 조회",
    "querying": "조회중...",
    "query": "조회",
    "today": "오늘",
    "noOrders": "주문 내역이 없습니다.",
    "restaurantCount": "{n}개 식당"
  },

  // ── 주문 상세 ──
  "orderDetail": {
    "loadingOrder": "주문 정보를 불러오는 중...",
    "notFound": "주문을 찾을 수 없습니다.",
    "orderStatus": "주문 현황",
    "orderNumber": "주문번호",
    "restaurant": "식당",
    "deliveryAddress": "배달 주소",
    "estimatedTime": "예상 배달 시간",
    "aboutMinutes": "약 {minutes}분",
    "driver": "배달원",
    "orderItems": "주문 메뉴"
  },

  // ── 주문 상태 (공통) ──
  "orderStatus": {
    "pending": "주문 요청됨",
    "pendingConfirmation": "확인 대기중",
    "confirmed": "주문 확정",
    "pickedUp": "픽업 완료",
    "delivering": "배달 중",
    "completed": "배달 완료",
    "cancelled": "주문 취소"
  },

  // ── 음식 카테고리 ──
  "foodCategory": {
    "chicken": "치킨",
    "cafe": "카페",
    "chinese": "중식",
    "japanese": "일식/횟집",
    "bunsik": "분식",
    "western": "양식/피자",
    "meat": "고기/구이",
    "korean": "한식",
    "other": "기타"
  },

  // ── 푸터 ──
  "footer": {
    "companyInfo": "블록체인경제연구소 | 대표: 장종혁 | 사업자등록번호: 306-07-92877",
    "contact": "연락처: 010-2569-6532 | support@hkd-delivery.kr",
    "terms": "이용약관",
    "privacy": "개인정보처리방침",
    "refund": "환불정책",
    "copyright": "Copyright 2026 한경배달. All rights reserved."
  },

  // ── 언어 선택 ──
  "language": {
    "label": "언어",
    "ko": "한국어",
    "en": "English",
    "ja": "日本語",
    "zh": "中文",
    "fr": "Français",
    "de": "Deutsch",
    "es": "Español"
  },

  // ── 전화번호 입력 ──
  "phone": {
    "countryCode": "국가번호",
    "invalidNumber": "올바른 전화번호 형식이 아닙니다",
    "country": {
      "KR": "🇰🇷 한국",
      "US": "🇺🇸 미국",
      "JP": "🇯🇵 일본",
      "CN": "🇨🇳 중국",
      "FR": "🇫🇷 프랑스",
      "DE": "🇩🇪 독일",
      "ES": "🇪🇸 스페인"
    }
  },

  // ── 백엔드 API 에러 메시지 ──
  "apiError": {
    "paymentIdRequired": "paymentId와 amount는 필수입니다",
    "invalidAmount": "유효하지 않은 결제 금액입니다",
    "paymentNotFound": "결제 정보를 찾을 수 없습니다",
    "phoneRequired": "전화번호가 필요합니다",
    "userIdOrPhoneRequired": "userId 또는 phone이 필요합니다.",
    "orderItemsRequired": "주문 항목이 필요합니다.",
    "someItemsUnavailable": "일부 상품을 사용할 수 없습니다.",
    "invalidPhoneFormat": "올바른 전화번호 형식이 아닙니다"
  },

  // ── SMS 템플릿 (백엔드) ──
  "sms": {
    "brandPrefix": "[한경배달]",
    "orderReceived": {
      "title": "주문이 요청되었습니다.",
      "orderNumber": "주문번호: {orderNumber}",
      "restaurant": "식당: {restaurantName}",
      "menu": "메뉴: {items}",
      "deliveryFee": "배달비: ₩{deliveryFee}",
      "totalAmount": "총액: ₩{totalAmount}",
      "estimatedTime": "예상 배달 시간: 약 {estimatedTime}분",
      "waitingPickupTime": "업체에서 픽업 가능 시간을 확인중입니다."
    },
    "confirmation": {
      "estimatedPickup": "예상 픽업 시간: {pickupTimeStr}",
      "estimatedDelivery": "예상 배달 시간: 약 {estimatedDeliveryTime}분",
      "confirmQuestion": "주문을 확정하시겠습니까?",
      "confirmLink": "확정: {confirmUrl}",
      "cancelLink": "취소: {cancelUrl}",
      "autoCancel": "10분 이내 미확정 시 자동 취소됩니다."
    },
    "confirmed": "주문번호: {orderNumber}이(가) 확정되었습니다.\n업체에서 식당에 주문을 넣고 픽업 후 배달을 시작합니다.",
    "cancelled": "주문번호: {orderNumber}이(가) 취소되었습니다.",
    "pickedUp": "주문번호: {orderNumber}의 결제가 완료되고 픽업되었습니다.\n배달을 시작합니다.",
    "deliveryComplete": "주문번호: {orderNumber}의 배달이 완료되었습니다.\n\n감사합니다.",
    "pickupNotification": "주문번호: {orderNumber}\n픽업 가능 시간: {pickupTimeStr}\n\n해당 시간에 픽업 예정입니다.",
    "driverAssigned": "주문번호 {orderNumber}에 배달원이 배정되었습니다.",
    "driverDeparted": "주문번호 {orderNumber}의 음식을 픽업하러 출발합니다.",
    "delivering": "주문번호 {orderNumber}이(가) 배달 중입니다.",
    "verificationCode": "성인 인증번호: {code}\n\n3분 이내에 입력해주세요.",
    "authCode": "인증번호: {verificationCode}\n3분 이내 입력해주세요.",
    "orderLink": "주문을 시작하려면 아래 링크를 클릭하세요.\n{targetUrl}"
  }
}
```

**전체 키 수: 약 195개** (중첩 제외 리프 노드 기준, SMS + phone + apiError 포함)

> **참고**: `utils/thumbnail.ts`에 한국어 카테고리명과 regex 패턴(치킨|닭|후라이드, 피자, 햄버거|버거 등 ~20개)이 하드코딩되어 있다. 이들은 SVG 썸네일 생성에 사용되며, 번역 파일의 `foodCategory` 키와 연동하여 처리해야 한다.

---

## 4. 구현 계획

### Phase 1: 인프라 구축 (Day 1)

#### 1-1. 패키지 설치

```bash
npm install next-intl
```

#### 1-2. i18n 설정 파일 생성

**`src/i18n/config.ts`**
```typescript
export const locales = ['ko', 'en', 'ja', 'zh', 'fr', 'de', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
};
```

#### 1-3. 요청별 설정 (`src/i18n/request.ts`)

```typescript
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { locales, defaultLocale, Locale } from './config';

function resolveLocale(acceptLanguage: string | null, cookieLocale: string | null): Locale {
  // 1순위: 쿠키에 저장된 사용자 선택
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  // 2순위: Accept-Language 헤더 파싱
  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(',')
      .map(lang => {
        const [code, q] = lang.trim().split(';q=');
        return { code: code.split('-')[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { code } of preferred) {
      if (locales.includes(code as Locale)) {
        return code as Locale;
      }
    }
  }

  // 3순위: 기본값 (영어)
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const headerStore = headers();

  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value ?? null;
  const acceptLanguage = headerStore.get('accept-language') ?? null;
  const locale = resolveLocale(acceptLanguage, cookieLocale);

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

#### 1-4. Next.js 설정 업데이트 (`next.config.js`)

```javascript
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};

module.exports = withNextIntl(nextConfig);
```

#### 1-5. 레이아웃 수정 (`layout.tsx`)

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        {/* footer도 번역 적용 */}
      </body>
    </html>
  );
}
```

#### 1-6. 언어 전환 API 라우트 (`app/api/locale/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { locales } from '@/i18n/config';

export async function POST(request: NextRequest) {
  const { locale } = await request.json();

  if (!locales.includes(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1년
    sameSite: 'lax',
  });

  return response;
}
```

---

### Phase 2: 번역 파일 작성 (Day 2–3)

#### 2-1. 한국어 원본 작성 (`ko.json`)

위 섹션 3의 전체 구조를 기반으로 `ko.json` 작성. 현재 하드코딩된 문자열을 그대로 사용.

#### 2-2. 영어 번역 (`en.json`)

영어를 기본 폴백 언어로 사용하므로, 가장 먼저 완성해야 함.

```jsonc
{
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "retry": "Retry",
    "backToMain": "Back to Home",
    "cart": "Cart",
    "viewCart": "View Cart",
    "myOrders": "My Orders",
    "notDeliveryTime": "Delivery is not available at this time",
    "closedToday": "Closed today (regular holiday)",
    "businessHours": "Hours: {hours}",
    "businessHoursNotSet": "Hours not set",
    "open24h": "Open 24 hours",
    "count": "{n} items",
    "deliveryAvailable": "{n} available for delivery"
  },
  "home": {
    "title": "HKD Delivery",
    "description": "Jeju Hangyeong Food Delivery Service"
    // ... 전체 키 번역
  }
  // ... 나머지 모든 섹션
}
```

#### 2-3. 나머지 5개 언어 번역

| 언어 | 파일 | 번역 방법 |
|------|------|-----------|
| 일본어 | `ja.json` | 전문 번역 (제주 관광객 대상 핵심 언어) |
| 중국어 | `zh.json` | 전문 번역 (간체자, 관광객 대상) |
| 프랑스어 | `fr.json` | AI 초벌 + 네이티브 검수 |
| 독일어 | `de.json` | AI 초벌 + 네이티브 검수 |
| 스페인어 | `es.json` | AI 초벌 + 네이티브 검수 |

#### 2-4. 특수 처리 항목

**복수형 처리 (next-intl ICU 형식)**:
```json
{
  "common": {
    "count": "{n, plural, =0 {0 items} one {1 item} other {{n} items}}"
  }
}
```
> 참고: 한국어/일본어/중국어는 복수형 구분이 없으므로 `{n}개`로 충분. 영어/프랑스어/독일어/스페인어는 복수형 규칙 적용.

**동적 값이 포함된 문자열**:
```json
{
  "orderDetail": {
    "aboutMinutes": "About {minutes} min",
    "notAccepting": "{name} is not accepting orders right now."
  }
}
```

**번역하지 않는 항목**:
- 브랜드명 "한경배달" → 각 언어에서 "HKD Delivery" 등으로 현지화하되, 로고는 그대로 유지
- 사업자등록번호, 연락처 등 법적 정보 → 한국어 원문 유지 (법적 요건)
- 식당 이름, 메뉴 이름 → DB에서 오는 데이터이므로 번역 대상 아님
- 코드 주석 (`// 한국어 주석`) → 번역 대상 아님 (개발자용)
- console.log/error 메시지 → 번역 대상 아님 (디버깅용)

**통화 표시 형식 — KRW 통일**:

모든 가격은 한국 원화(KRW)로만 결제되므로, 통화 기호를 **₩(원)**으로 전체 언어에 통일한다. locale별로 다른 통화 기호를 사용하지 않는다.

```json
// 전 언어 공통: "₩10,000" → "₩{amount}"
// ko: "₩10,000"
// en: "₩10,000"
// ja: "₩10,000"
// zh: "₩10,000"
// fr/de/es: "₩10,000"
```

> 참고: `원`이라는 한국어 접미사 대신 국제 통화 기호 `₩`을 사용하여 모든 언어에서 동일하게 표시한다. 천 단위 구분자(,)는 `Intl.NumberFormat('ko-KR')`로 일관 포맷한다.

**`alert()` → 커스텀 모달 전환**:
현재 `checkout/page.tsx`에 16개 이상의 `alert()` 호출이 있다. `alert()`는 브라우저 네이티브 다이얼로그로 i18n 적용이 가능하지만, UX 일관성을 위해 커스텀 모달 컴포넌트로 전환하는 것을 권장한다.

---

### Phase 3: 컴포넌트 마이그레이션 (Day 3–5)

각 페이지의 하드코딩 문자열을 `useTranslations` 훅으로 교체한다.

#### 3-1. 마이그레이션 패턴

**Before (현재):**
```tsx
<h1>한경배달</h1>
<p>현재 배달 가능한 식당이 없습니다.</p>
<button>장바구니</button>
```

**After (변경 후):**
```tsx
import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations();

  return (
    <>
      <h1>{t('home.title')}</h1>
      <p>{t('home.empty.noRestaurants')}</p>
      <button>{t('common.cart')}</button>
    </>
  );
}
```

**동적 값:**
```tsx
// Before
<span>{stores.length}개</span>
<span>{openCount}곳 배달가능</span>

// After
<span>{t('common.count', { n: stores.length })}</span>
<span>{t('common.deliveryAvailable', { n: openCount })}</span>
```

#### 3-2. 페이지별 마이그레이션 순서

우선순위는 **사용 빈도**와 **문자열 수**를 기준으로 정한다.

| 순서 | 페이지 | 문자열 수 | 난이도 | 비고 |
|:----:|--------|:---------:|:------:|------|
| 1 | `layout.tsx` (공통 레이아웃) | 8 | 낮음 | Provider 설정 포함 |
| 2 | `page.tsx` (홈) | 35 | 높음 | 가장 많은 문자열 |
| 3 | **`checkout`** | **55** | **높음** | alert 16개 + 폼 라벨 + 에러 ⚠️ |
| 4 | `restaurant/[id]` | 20 | 중간 | |
| 5 | `store/[id]` | 25 | 중간 | 카테고리 매핑 포함 |
| 6 | `checkout/complete` | 18 | 중간 | |
| 7 | `my-orders` | 18 | 중간 | 상태 매핑 + 추가 라벨 |
| 8 | `order/[id]` | 15 | 낮음 | |
| 9 | `confirm/[token]` | **11** | 중간 | 성공/실패/로딩 3가지 상태 |
| 10 | `cancel/[token]` | **12** | 중간 | 환불 관련 문자열 포함 |
| 11 | `utils/thumbnail.ts` | **20** | 중간 | 카테고리 매핑 + regex 패턴 |
| 12 | 백엔드 API 응답 | **18** | 중간 | 사용자에게 노출되는 에러 메시지 |

#### 3-3. 언어 선택 UI 컴포넌트

```tsx
// src/components/LanguageSwitcher.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { locales, localeNames, Locale } from '@/i18n/config';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('language');

  const handleChange = async (newLocale: Locale) => {
    await fetch('/api/locale', {
      method: 'POST',
      body: JSON.stringify({ locale: newLocale }),
    });
    router.refresh();
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value as Locale)}
      aria-label={t('label')}
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeNames[loc]}
        </option>
      ))}
    </select>
  );
}
```

**배치 위치**: 홈 페이지 헤더 우측 상단 (🌐 아이콘 + 드롭다운)

#### 3-4. 국제 전화번호 입력 컴포넌트

국가코드 선택이 가능한 전화번호 입력 컴포넌트를 구현한다.

**패키지 설치:**
```bash
npm install libphonenumber-js
```

> `libphonenumber-js`는 Google의 libphonenumber의 경량 JS 포트로, 국제 전화번호 파싱/검증/포맷팅을 지원한다 (~150KB gzipped).

**`src/components/PhoneInput.tsx`:**
```tsx
'use client';

import { useState, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { parsePhoneNumberFromString, getCountries, getCountryCallingCode } from 'libphonenumber-js';

// locale → 기본 국가코드 매핑
const LOCALE_TO_COUNTRY: Record<string, string> = {
  ko: 'KR',  // +82
  en: 'US',  // +1
  ja: 'JP',  // +81
  zh: 'CN',  // +86
  fr: 'FR',  // +33
  de: 'DE',  // +49
  es: 'ES',  // +34
};

// 주요 국가 우선 표시 (나머지는 알파벳 순)
const PRIORITY_COUNTRIES = ['KR', 'US', 'JP', 'CN', 'FR', 'DE', 'ES'];

interface PhoneInputProps {
  value: string;
  onChange: (e164Phone: string, displayPhone: string, countryCode: string) => void;
  placeholder?: string;
}

export default function PhoneInput({ value, onChange, placeholder }: PhoneInputProps) {
  const locale = useLocale();
  const t = useTranslations('phone');
  const [country, setCountry] = useState(LOCALE_TO_COUNTRY[locale] || 'US');
  const [nationalNumber, setNationalNumber] = useState('');

  const callingCode = getCountryCallingCode(country as any);

  const handleNumberChange = (input: string) => {
    setNationalNumber(input);
    const parsed = parsePhoneNumberFromString(input, country as any);
    if (parsed && parsed.isValid()) {
      onChange(parsed.format('E.164'), parsed.formatInternational(), country);
    } else {
      onChange('', input, country);
    }
  };

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    // 국가 변경 시 번호 재파싱
    if (nationalNumber) {
      const parsed = parsePhoneNumberFromString(nationalNumber, newCountry as any);
      if (parsed && parsed.isValid()) {
        onChange(parsed.format('E.164'), parsed.formatInternational(), newCountry);
      }
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <select
        value={country}
        onChange={(e) => handleCountryChange(e.target.value)}
        aria-label={t('countryCode')}
        style={{ width: '120px' }}
      >
        {PRIORITY_COUNTRIES.map(code => (
          <option key={code} value={code}>
            {t(`country.${code}`)} +{getCountryCallingCode(code as any)}
          </option>
        ))}
        <option disabled>──────</option>
        {getCountries()
          .filter(c => !PRIORITY_COUNTRIES.includes(c))
          .sort()
          .map(code => (
            <option key={code} value={code}>
              {code} +{getCountryCallingCode(code as any)}
            </option>
          ))}
      </select>
      <input
        type="tel"
        value={nationalNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder={country === 'KR' ? '010-1234-5678' : placeholder}
        style={{ flex: 1 }}
      />
    </div>
  );
}
```

**번역 키 추가 (`phone` 섹션):**
```json
{
  "phone": {
    "countryCode": "국가번호",
    "invalidNumber": "올바른 전화번호 형식이 아닙니다",
    "country": {
      "KR": "🇰🇷 한국",
      "US": "🇺🇸 미국",
      "JP": "🇯🇵 일본",
      "CN": "🇨🇳 중국",
      "FR": "🇫🇷 프랑스",
      "DE": "🇩🇪 독일",
      "ES": "🇪🇸 스페인"
    }
  }
}
```

**적용 대상 페이지:**

| 페이지 | 현재 | 변경 |
|--------|------|------|
| `checkout/page.tsx` | `<input type="tel">` | `<PhoneInput>` 컴포넌트로 교체 |
| `my-orders/page.tsx` | `<input type="tel">` | `<PhoneInput>` 컴포넌트로 교체 |
| `driver/page.tsx` | 텍스트 input | `<PhoneInput>` 컴포넌트로 교체 |

**DB 저장 형식 변경:**

```
현재:   01012345678          (한국 내수 번호)
변경후: +821012345678        (E.164 국제 표준)
```

| 항목 | 변경 내용 |
|------|-----------|
| DB 스키마 | `User.phone` 필드 길이 확장 (최대 15자 → 20자), E.164 형식 |
| 백엔드 검증 | `/^01[016789]\d{7,8}$/` → `libphonenumber-js`의 `isValidPhoneNumber()` |
| SMS 발송 | Naver SENS API에 국제번호 전달 (국제 SMS 발송 설정 필요) |
| 기존 데이터 마이그레이션 | 기존 `010...` 번호에 `+82` 접두사 추가: `UPDATE users SET phone = '+82' \|\| phone WHERE phone NOT LIKE '+%'` |
| PortOne 결제 | `customer.phoneNumber`에 E.164 형식 전달 |

**하위 호환성:**
```typescript
// 백엔드: 기존 한국 번호도 수용
function normalizePhone(phone: string): string {
  if (phone.startsWith('+')) return phone;           // 이미 국제 형식
  if (phone.startsWith('01')) return '+82' + phone;  // 한국 내수 → E.164
  return phone;
}
```

#### 3-5. 결제창 (PortOne) 다국어 연동

현재 `checkout/page.tsx`의 결제 호출에 `locale` 파라미터를 추가한다.

**Before (현재):**
```typescript
const paymentParams = {
  storeId: PORTONE_STORE_ID,
  channelKey: PORTONE_CHANNEL_KEY,
  paymentId: `payment-${Date.now()}`,
  orderName: restaurantNames,
  totalAmount: Math.floor(getTotal()),
  currency: 'CURRENCY_KRW',
  payMethod: 'CARD',
  // ... locale 없음
};
```

**After (변경 후):**
```typescript
import { useLocale } from 'next-intl';

// HKD locale → PortOne locale 매핑
const PORTONE_LOCALE_MAP: Record<string, string> = {
  ko: 'KO_KR',
  en: 'EN_US',
  ja: 'JA_JP',
  zh: 'ZH_CN',
  fr: 'FR_FR',
  de: 'DE_DE',
  es: 'ES_ES',
};

function getPortOneLocale(locale: string): string {
  return PORTONE_LOCALE_MAP[locale] ?? 'EN_US';
}

// 결제 호출 시
const locale = useLocale();

const paymentParams = {
  storeId: PORTONE_STORE_ID,
  channelKey: PORTONE_CHANNEL_KEY,
  paymentId: `payment-${Date.now()}`,
  orderName: restaurantNames,
  totalAmount: Math.floor(getTotal()),
  currency: 'CURRENCY_KRW',
  payMethod: 'CARD',
  locale: getPortOneLocale(locale),  // ✅ 추가
  // ...
};
```

> **주의**: PortOne SDK는 현재 PG사가 지원하지 않는 locale을 전달받으면 자동으로 한국어로 폴백한다. 이를 방지하기 위해 PG사별 지원 여부를 확인하는 로직을 추가하거나, 지원되지 않을 경우 `EN_US`를 명시적으로 전달해야 한다.

---

### Phase 4: SMS 백엔드 다국어화 (Day 5–6)

SMS 템플릿 다국어화는 **백엔드(Express)** 작업이다. 고객의 언어 설정을 주문 시점에 저장하고, SMS 발송 시 해당 언어의 템플릿을 사용한다.

#### 4-1. 아키텍처 설계

```
[고객 브라우저] ─→ locale 쿠키/헤더 ─→ [프론트엔드]
                                            │
                                    주문 생성 API 호출 시
                                    locale 파라미터 포함
                                            │
                                            ▼
                                     [백엔드 API]
                                            │
                              orders 테이블에 locale 저장
                                            │
                                            ▼
                                    [SMSService]
                                            │
                              order.locale로 번역 파일 로드
                                            │
                                            ▼
                                    [Naver SENS API]
```

#### 4-2. DB 스키마 변경

```sql
ALTER TABLE orders ADD COLUMN locale VARCHAR(5) DEFAULT 'ko';
```

#### 4-3. 주문 생성 API 수정

프론트엔드에서 주문 생성 시 현재 locale을 함께 전달한다.

**프론트엔드 (`checkout/complete/page.tsx`):**
```typescript
const locale = useLocale();

const orderResponse = await fetch('/api/v1/orders', {
  method: 'POST',
  body: JSON.stringify({
    ...orderData,
    locale,  // ✅ 추가
  }),
});
```

**백엔드 (주문 생성 라우트):**
```typescript
const { locale = 'ko', ...orderData } = req.body;
const order = await prisma.order.create({
  data: { ...orderData, locale },
});
```

#### 4-4. 백엔드 번역 시스템

```
backend/src/
├── i18n/
│   ├── index.ts           # 번역 로더 + t() 함수
│   └── messages/
│       ├── ko.json        # 프론트엔드와 sms 키 공유
│       ├── en.json
│       ├── ja.json
│       ├── zh.json
│       ├── fr.json
│       ├── de.json
│       └── es.json
```

**`backend/src/i18n/index.ts`:**
```typescript
import ko from './messages/ko.json';
import en from './messages/en.json';
import ja from './messages/ja.json';
import zh from './messages/zh.json';
import fr from './messages/fr.json';
import de from './messages/de.json';
import es from './messages/es.json';

const messages: Record<string, any> = { ko, en, ja, zh, fr, de, es };

export function t(locale: string, key: string, params?: Record<string, string | number>): string {
  const msgs = messages[locale] || messages['en'];
  const keys = key.split('.');
  let value: any = msgs;

  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      // 폴백: 영어 → 한국어 → 키 반환
      value = getNestedValue(messages['en'], keys)
           ?? getNestedValue(messages['ko'], keys)
           ?? key;
      break;
    }
  }

  if (typeof value === 'string' && params) {
    return value.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  }

  return String(value);
}

function getNestedValue(obj: any, keys: string[]): string | undefined {
  let val = obj;
  for (const k of keys) {
    val = val?.[k];
    if (val === undefined) return undefined;
  }
  return typeof val === 'string' ? val : undefined;
}
```

#### 4-5. SMSService 리팩토링

**Before (현재):**
```typescript
buildOrderReceivedSMS(order: any): string {
  return `[한경배달]\n주문이 요청되었습니다.\n주문번호: ${order.orderNumber}\n...`;
}
```

**After (변경 후):**
```typescript
import { t } from '../i18n';

buildOrderReceivedSMS(order: any): string {
  const locale = order.locale || 'ko';
  const prefix = t(locale, 'sms.brandPrefix');

  return [
    prefix,
    t(locale, 'sms.orderReceived.title'),
    t(locale, 'sms.orderReceived.orderNumber', { orderNumber: order.orderNumber }),
    t(locale, 'sms.orderReceived.restaurant', { restaurantName: order.restaurant.name }),
    t(locale, 'sms.orderReceived.menu', { items: this.formatItems(order.items) }),
    t(locale, 'sms.orderReceived.deliveryFee', { deliveryFee: order.deliveryFee }),
    t(locale, 'sms.orderReceived.totalAmount', { totalAmount: order.totalAmount }),
    t(locale, 'sms.orderReceived.estimatedTime', { estimatedTime: order.estimatedTime }),
    '',
    t(locale, 'sms.orderReceived.waitingPickupTime'),
  ].join('\n');
}
```

동일한 패턴을 12개 SMS 템플릿 모두에 적용한다. `admin.routes.ts`와 `webhook.routes.ts`에 인라인으로 작성된 SMS 문자열도 SMSService의 메서드로 추출하여 통합한다.

#### 4-6. 관리자/배달원 페이지에 고객 언어 표시

주문 데이터에 포함된 `locale` 필드를 관리자와 배달원 UI에 표시한다. 이 작업은 관리자/배달원 페이지 자체를 다국어화하는 것이 아니라, **고객의 언어 정보를 보여주는 것**이다.

**API 응답에 locale 포함:**

```typescript
// backend: 주문 조회 API 응답에 locale 추가
{
  id: "order-123",
  orderNumber: "HKD-20260404-001",
  user: {
    phone: "+821012345678",
    name: "John"
  },
  locale: "en",          // ✅ 추가
  localeName: "English",  // ✅ 추가 (표시용)
  // ...
}
```

**관리자 주문 목록 (`admin/orders/page.tsx`):**

```tsx
// 언어 배지 컴포넌트
const LOCALE_FLAGS: Record<string, string> = {
  ko: '🇰🇷', en: '🇺🇸', ja: '🇯🇵', zh: '🇨🇳', fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸'
};

function LocaleBadge({ locale }: { locale: string }) {
  const flag = LOCALE_FLAGS[locale] || '🌐';
  const name = locale.toUpperCase();
  const isNonKorean = locale !== 'ko';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      background: isNonKorean ? '#FFF3CD' : '#E8F5E9',  // 외국어는 노란 배경으로 강조
      border: isNonKorean ? '1px solid #FFC107' : '1px solid #81C784',
    }}>
      {flag} {name}
    </span>
  );
}
```

**관리자 주문 목록에 배치:**
```tsx
// 주문 카드 내부
<div className="order-card-header">
  <span>#{order.orderNumber}</span>
  <LocaleBadge locale={order.locale} />    {/* ✅ 추가 */}
  <span>{order.user.name || order.user.phone}</span>
</div>
```

**관리자 주문 상세 (`admin/orders/[orderId]/page.tsx`):**
```tsx
// 고객 정보 섹션에 추가
<div>
  <label>고객명</label>
  <span>{order.user.name || '-'}</span>
</div>
<div>
  <label>전화번호</label>
  <span>{order.user.phone}</span>     {/* E.164 형식으로 국가코드 포함 표시 */}
</div>
<div>
  <label>고객 언어</label>              {/* ✅ 추가 */}
  <LocaleBadge locale={order.locale} />
</div>
```

**배달원 페이지 (`driver/page.tsx`):**
```tsx
// 배정된 주문 카드
<div className="order-info">
  <span>{order.customerName}</span>
  <LocaleBadge locale={order.locale} />    {/* ✅ 추가 */}
  <span>{order.customerPhone}</span>
</div>
```

> **목적**: 관리자와 배달원이 외국어 고객의 주문을 한눈에 식별하여, 필요 시 영어 등으로 대응할 수 있도록 한다. 특히 배달원이 고객에게 전화할 때 어떤 언어로 소통해야 하는지 사전에 파악할 수 있다.

#### 4-7. SMS 문자열 특수 고려사항

| 항목 | 설명 |
|------|------|
| 문자 길이 제한 | SMS 80바이트, LMS 2,000바이트. 영어는 1byte/char, 한국어는 2byte/char → 영어 번역이 한국어보다 길어질 수 있으나 byte 수는 비슷 |
| 통화 단위 | 전 언어 `₩{n}` 통일 (KRW). 천 단위 콤마는 `Intl.NumberFormat` 활용 |
| 식당명/메뉴명 | DB 데이터이므로 번역 불가 → 한국어 그대로 표시. SMS에 안내 문구 추가 검토 |
| 브랜드명 | `[한경배달]` → 모든 언어에서 `[HKD]` 또는 `[HKD Delivery]`로 통일할지 결정 필요 |
| 인증 관련 SMS | 인증번호, 시간 제한 안내는 반드시 정확한 번역 필요 (보안 관련) |

---

### Phase 5: 테스트 및 검증 (Day 6–7)

#### 5-1. 단위 테스트

**프론트엔드 (locale 감지 / UI)**

| 테스트 ID | 대상 | 검증 항목 |
|-----------|------|-----------|
| I18N-01 | `resolveLocale()` | Accept-Language 파싱 및 매칭 |
| I18N-02 | `resolveLocale()` | 쿠키 우선순위 확인 |
| I18N-03 | `resolveLocale()` | 지원하지 않는 언어 → 영어 폴백 |
| I18N-04 | `resolveLocale()` | Accept-Language 없음 → 영어 폴백 |
| I18N-05 | 번역 파일 | 모든 7개 언어 파일의 키 일치 검증 |
| I18N-06 | 번역 파일 | 빈 값 없음 검증 |
| I18N-07 | 번역 파일 | 동적 변수 `{placeholder}` 일치 검증 |
| I18N-08 | `LanguageSwitcher` | 언어 전환 시 쿠키 설정 확인 |
| I18N-09 | `POST /api/locale` | 유효 locale → 200 + 쿠키 |
| I18N-10 | `POST /api/locale` | 무효 locale → 400 |

**결제창 다국어 (PortOne)**

| 테스트 ID | 대상 | 검증 항목 |
|-----------|------|-----------|
| I18N-11 | `getPortOneLocale()` | ko → KO_KR 매핑 |
| I18N-12 | `getPortOneLocale()` | en → EN_US 매핑 |
| I18N-13 | `getPortOneLocale()` | 미지원 locale → EN_US 폴백 |
| I18N-14 | 결제 호출 | paymentParams에 locale 포함 확인 |

**SMS 백엔드 다국어**

| 테스트 ID | 대상 | 검증 항목 |
|-----------|------|-----------|
| I18N-15 | `t()` 함수 | 한국어 키 정상 반환 |
| I18N-16 | `t()` 함수 | 영어 키 정상 반환 |
| I18N-17 | `t()` 함수 | 미지원 언어 → 영어 폴백 |
| I18N-18 | `t()` 함수 | 존재하지 않는 키 → 키 문자열 반환 |
| I18N-19 | `t()` 함수 | 동적 파라미터 치환 (`{orderNumber}` 등) |
| I18N-20 | `buildOrderReceivedSMS()` | 7개 언어별 SMS 생성 검증 |
| I18N-21 | `buildConfirmationSMS()` | 확정/취소 링크 포함 확인 |
| I18N-22 | `buildConfirmedSMS()` | 7개 언어별 확정 SMS |
| I18N-23 | SMS byte 길이 | 각 언어 SMS가 LMS 한도(2,000byte) 이내 |
| I18N-24 | 주문 생성 API | locale 파라미터 → DB 저장 확인 |
| I18N-25 | 주문 생성 API | locale 미전달 → 기본값 'ko' 확인 |

**국제 전화번호 입력**

| 테스트 ID | 대상 | 검증 항목 |
|-----------|------|-----------|
| I18N-26 | `PhoneInput` | 한국어 locale → 기본 국가 KR (+82) |
| I18N-27 | `PhoneInput` | 영어 locale → 기본 국가 US (+1) |
| I18N-28 | `PhoneInput` | 일본어 locale → 기본 국가 JP (+81) |
| I18N-29 | `PhoneInput` | 국가 변경 시 국가코드 업데이트 |
| I18N-30 | `PhoneInput` | 유효한 번호 → E.164 형식 출력 (`+821012345678`) |
| I18N-31 | `PhoneInput` | 유효하지 않은 번호 → 빈 문자열 출력 |
| I18N-32 | `normalizePhone()` | 기존 `01012345678` → `+821012345678` 변환 |
| I18N-33 | `normalizePhone()` | 이미 `+82...` 형식 → 그대로 반환 |
| I18N-34 | 백엔드 검증 | E.164 형식 국제번호 통과 |
| I18N-35 | 백엔드 검증 | 유효하지 않은 국제번호 거부 |
| I18N-36 | DB 마이그레이션 | 기존 한국 번호에 +82 접두사 정상 추가 |

**관리자/배달원 언어 표시**

| 테스트 ID | 대상 | 검증 항목 |
|-----------|------|-----------|
| I18N-37 | `LocaleBadge` | ko → 🇰🇷 KO (녹색 배경) |
| I18N-38 | `LocaleBadge` | en → 🇺🇸 EN (노란 배경 강조) |
| I18N-39 | 주문 API 응답 | locale 필드 포함 확인 |
| I18N-40 | 관리자 주문 목록 | LocaleBadge 렌더링 확인 |
| I18N-41 | 배달원 배정 주문 | locale 정보 포함 확인 |

#### 5-2. 번역 키 완전성 검증 스크립트

```typescript
// scripts/validate-translations.ts
import fs from 'fs';
import path from 'path';
import { locales } from '../src/i18n/config';

function getKeys(obj: any, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, val]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof val === 'object' && val !== null ? getKeys(val, fullKey) : [fullKey];
  });
}

const baseMessages = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/i18n/messages/ko.json'), 'utf-8')
);
const baseKeys = getKeys(baseMessages);

let hasError = false;

for (const locale of locales) {
  if (locale === 'ko') continue;
  const messages = JSON.parse(
    fs.readFileSync(path.join(__dirname, `../src/i18n/messages/${locale}.json`), 'utf-8')
  );
  const keys = getKeys(messages);

  const missing = baseKeys.filter(k => !keys.includes(k));
  const extra = keys.filter(k => !baseKeys.includes(k));

  if (missing.length) {
    console.error(`[${locale}] Missing keys: ${missing.join(', ')}`);
    hasError = true;
  }
  if (extra.length) {
    console.warn(`[${locale}] Extra keys: ${extra.join(', ')}`);
  }
}

process.exit(hasError ? 1 : 0);
```

#### 5-3. 수동 검증 체크리스트

**프론트엔드 UI:**
- [ ] 각 7개 언어로 전체 고객 플로우 수행 (홈 → 식당 → 장바구니 → 결제 → 완료)
- [ ] 브라우저 언어를 각 언어로 설정했을 때 자동 감지 확인
- [ ] 지원하지 않는 언어(예: 태국어)로 설정 시 영어 표시 확인
- [ ] 언어 선택기로 수동 전환 후 페이지 새로고침해도 유지 확인
- [ ] 모바일 브라우저(iOS Safari, Android Chrome)에서 시스템 언어 감지 확인
- [ ] 긴 번역 문자열(독일어 등)이 UI 레이아웃을 깨뜨리지 않는지 확인
- [ ] SMS 링크로 접속 시 정상 언어 감지 확인
- [ ] 식당/메뉴 이름 등 DB 데이터는 번역되지 않음 확인

**결제창:**
- [ ] 한국어 설정 시 결제창 한국어 표시 확인
- [ ] 영어 설정 시 결제창 영어 표시 확인
- [ ] 일본어/중국어 설정 시 PG사별 지원 여부에 따른 동작 확인
- [ ] 프랑스어/독일어/스페인어 설정 시 폴백(EN_US) 정상 동작 확인
- [ ] 결제 완료 후 돌아온 페이지가 선택 언어 유지 확인

**국제 전화번호:**
- [ ] 한국어 설정 시 기본 국가코드 +82(한국) 확인
- [ ] 영어 설정 시 기본 국가코드 +1(미국) 확인
- [ ] 일본어/중국어/프랑스어/독일어/스페인어 각각 올바른 기본 국가코드 확인
- [ ] 한국어 사용자가 다른 국가코드(예: +81 일본)로 변경 가능 확인
- [ ] 외국 번호(+1-555-1234 등) 입력 후 정상 주문 생성 확인
- [ ] E.164 형식으로 DB에 저장되는지 확인
- [ ] 기존 한국 번호 사용자의 주문 조회가 정상 동작하는지 확인 (하위 호환)
- [ ] SMS가 국제번호로 정상 발송되는지 확인

**관리자/배달원 언어 표시:**
- [ ] 한국어 주문 → 관리자 주문 목록에 🇰🇷 KO 배지 표시 확인
- [ ] 영어 주문 → 관리자 주문 목록에 🇺🇸 EN 노란 배지 표시 확인
- [ ] 관리자 주문 상세에 "고객 언어" 필드 표시 확인
- [ ] 배달원 페이지 배정 주문에 언어 배지 표시 확인
- [ ] 외국어 고객 주문이 시각적으로 구분되는지 확인

**SMS:**
- [ ] 한국어 주문 → 한국어 SMS 수신 확인
- [ ] 영어 주문 → 영어 SMS 수신 확인
- [ ] 각 7개 언어로 주문 확정/취소 링크 SMS 수신 및 링크 동작 확인
- [ ] SMS 문자 길이가 LMS 한도 이내인지 확인 (특히 독일어/프랑스어)
- [ ] locale 미전달 주문(레거시) → 한국어 SMS 폴백 확인
- [ ] 인증번호 SMS 7개 언어 수신 확인

---

## 5. 일정 요약

| 단계 | 기간 | 작업 내용 | 산출물 | 상태 |
|:----:|:----:|-----------|--------|:----:|
| Phase 1 | Day 1 | 프론트엔드 i18n 인프라 구축 | 설정 파일, layout 수정, Provider | ✅ |
| Phase 2 | Day 2–4 | 번역 파일 7개 언어 작성 (244키 × 7 = 1,708 문자열) | `messages/*.json` × 7 (FE + BE) | ✅ |
| Phase 3 | Day 4–7 | 10개 대상 마이그레이션 + PhoneInput + PortOne locale | 수정된 페이지 9개 + 레이아웃 | ✅ |
| Phase 4 | Day 7–8 | SMS 백엔드 다국어화 + 관리자/배달원 언어 배지 | `backend/src/i18n/`, SMSService, LocaleBadge | ✅ |
| Phase 5 | Day 8–10 | 테스트 + 번역 키 검증 + 전체 플로우 검증 | 테스트 코드, 검증 리포트 | ✅ |

**총 예상 소요: 10일**

> 초기 추정(8일) 대비 2일 증가. 결제 페이지 문자열 수 대폭 증가(20→55)와 백엔드 API 에러 다국어화, thumbnail 유틸리티 작업 추가 반영.

---

## 6. 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| 독일어/프랑스어 등 긴 번역으로 UI 깨짐 | 레이아웃 파손 | Tailwind `truncate`, `break-words` 적용, 최대 너비 설정 |
| 번역 키 누락 | 사용자에게 키 문자열 노출 | CI에 번역 키 검증 스크립트 포함, `defaultTranslationValues` 설정 |
| SMS 링크의 쿠키 없는 첫 접속 | 언어 감지 부정확 | Accept-Language 헤더 기반 감지로 충분 (SMS 링크는 브라우저를 통해 열림) |
| 서버/클라이언트 컴포넌트 hydration 불일치 | React hydration 에러 | `NextIntlClientProvider`로 서버에서 결정된 locale을 클라이언트에 전달 |
| 식당 이름/메뉴가 한국어로만 표시 | 외국인 사용자 혼란 | 장기적으로 DB에 `name_en` 등 다국어 컬럼 추가 검토 (이번 범위 외) |
| PortOne PG사별 locale 지원 차이 | 일부 언어에서 결제창이 한국어로 표시 | PG사가 미지원 시 EN_US로 명시적 폴백, 결제 전 안내 메시지 표시 |
| SMS 번역 시 문자 길이 초과 | LMS 전환 또는 잘림 | 언어별 byte 길이 사전 검증, 긴 번역은 축약 버전 준비 |
| 레거시 주문 (locale 컬럼 없음) | SMS 발송 실패 | DB 마이그레이션 시 기존 주문 기본값 'ko' 설정, `locale ?? 'ko'` 폴백 |
| 프론트/백엔드 번역 키 불일치 | SMS에서 다른 키 사용 | 프론트엔드와 백엔드 JSON의 `sms` 섹션을 공유 빌드 스크립트로 동기화 |
| E.164 전환 시 기존 데이터 호환성 | 기존 `010...` 번호로 주문 조회 실패 | `normalizePhone()` 함수로 양방향 호환, 마이그레이션 스크립트 사전 실행 |
| 국제 SMS 발송 비용 | 해외 번호 SMS 비용 10~50배 | Naver SENS 국제 SMS 요금 사전 확인, 비용 한도 설정 |
| `libphonenumber-js` 번들 크기 | 프론트엔드 ~150KB 증가 | `libphonenumber-js/min` (최소 버전) 사용, dynamic import 적용 |
| 외국 번호로 한국 SMS 수신 불가 | 해외 로밍 미설정 시 SMS 미수신 | 주문 완료 페이지에서 주문 상태 조회 안내, 이메일 알림 병행 검토 |

---

## 7. 향후 확장 고려사항

1. **DB 다국어 데이터**: 식당명, 메뉴명의 다국어 지원은 DB 스키마 변경이 필요하며, 이번 범위에서는 제외. 추후 `restaurant_translations` 테이블 추가 검토.
2. **RTL 언어 지원**: 아랍어 등 RTL 언어 추가 시 `dir="rtl"` 속성과 Tailwind RTL 플러그인 필요.
3. **관리자/드라이버 페이지 다국어화**: 이번 범위는 고객 페이지만. 관리자 페이지는 내부 사용이므로 우선순위 낮음.
4. **자동 번역 CI**: 새 문자열 추가 시 번역되지 않은 키를 자동 감지하는 GitHub Action 추가.
5. **카카오톡 알림톡 전환**: SMS 대신 카카오 알림톡을 사용하면 템플릿 기반으로 다국어 메시지를 더 효율적으로 관리 가능. 알림톡은 이미지/버튼도 지원하여 UX 향상 기대.
6. **PG사 변경 검토**: 일본어/중국어 결제창 지원이 중요한 경우, 엑심베이(Eximbay) 채널 추가를 검토. 엑심베이는 8개 언어를 지원하며 해외 카드 결제에 특화.

---

## 8. 계획서 검토 결과 (코드베이스 전수 조사)

### 8.1 검토 일시

2026-04-04, 전체 프론트엔드/백엔드 코드 대상 전수 조사 수행

### 8.2 발견된 주요 누락 사항 및 반영 결과

| # | 누락 항목 | 영향도 | 상태 |
|:-:|-----------|:------:|:----:|
| 1 | `checkout/page.tsx` 문자열 수 과소 추정 (20→55) | 높음 | ✅ 반영 |
| 2 | `confirm/[token]` 문자열 수 과소 추정 (5→11) | 중간 | ✅ 반영 |
| 3 | `cancel/[token]` 문자열 수 과소 추정 (5→12) | 중간 | ✅ 반영 |
| 4 | 결제 폼 라벨 누락 (고객 정보, 배달 정보, 메모 등 25개) | 높음 | ✅ 반영 |
| 5 | `alert()` 다이얼로그 메시지 16개 미포함 | 높음 | ✅ 반영 |
| 6 | 환불 관련 문자열 누락 (환불 금액, 환불 상태, 처리 기간) | 중간 | ✅ 반영 |
| 7 | 백엔드 API 에러 메시지 18개 미포함 (`order.routes.ts`, `payment.routes.ts`) | 높음 | ✅ 반영 |
| 8 | `utils/thumbnail.ts` 카테고리 매핑 + regex 패턴 20개 미포함 | 중간 | ✅ 반영 |
| 9 | 통화 표시 형식 → KRW(₩) 전 언어 통일로 확정 | 중간 | ✅ 반영 |
| 10 | `my-orders` 추가 문자열 (오늘, 주문 내역 없음, N개 식당) | 낮음 | ✅ 반영 |
| 11 | `checkout/complete` 추가 문자열 (장바구니/금액 데이터 누락 에러) | 중간 | ✅ 반영 |
| 12 | `phone` 섹션 번역 키가 섹션 3 JSON에 미포함 | 낮음 | ✅ 반영 |

### 8.3 누락 없음 확인 항목

| 항목 | 결과 |
|------|------|
| `error.tsx`, `not-found.tsx`, `loading.tsx` | 해당 파일 없음 → 누락 아님 |
| `globals.css` 내 한국어 | CSS content 속성에 한국어 없음 → 누락 아님 |
| OpenGraph/SEO 메타 태그 | `layout.tsx`의 title/description만 → 이미 포함 |
| 코드 주석 내 한국어 | 번역 대상 아님 → 확인 완료 |
| console.log/error 내 한국어 | 디버깅용이므로 번역 대상 아님 → 확인 완료 |

### 8.4 수정된 규모 요약

| 항목 | 수정 전 | 수정 후 | 변화 |
|------|:-------:|:-------:|:----:|
| 프론트엔드 하드코딩 문자열 | ~163 | ~237 | +45% |
| 백엔드 API 에러 문자열 | 0 | ~18 | 신규 |
| 번역 키 총 수 | ~120 | ~195 | +63% |
| 총 번역 작업량 (키 × 7언어) | ~840 | ~1,365 | +63% |
| 예상 소요 일수 | 8일 | 10일 | +2일 |

---

## 9. 구현 완료 결과 (2026-04-04)

### 9.1 구현 완료 요약

전체 5개 Phase를 모두 구현 완료하였다. 아래는 각 Phase별 결과이다.

| Phase | 내용 | 상태 | 비고 |
|:-----:|------|:----:|------|
| Phase 1 | 프론트엔드 i18n 인프라 구축 | ✅ 완료 | next-intl, config, request, layout, locale API, LanguageSwitcher |
| Phase 2 | 번역 파일 7개 언어 작성 | ✅ 완료 | 프론트엔드 244키 × 7언어 + 백엔드 26키 × 7언어 |
| Phase 3 | 페이지 마이그레이션 + PhoneInput + PortOne locale | ✅ 완료 | 9개 페이지 + 1개 레이아웃 마이그레이션 |
| Phase 4 | SMS 백엔드 다국어화 + DB locale 컬럼 | ✅ 완료 | t() 함수, SMS 5개 메서드, Prisma schema |
| Phase 5 | 테스트 + 번역 키 검증 | ✅ 완료 | 번역 키 완전성 검증 통과 |

### 9.2 최종 규모

| 항목 | 계획 | 실제 | 비고 |
|------|:----:|:----:|------|
| 프론트엔드 번역 키 수 | ~195 | **244** | 검증 단계에서 누락 키 추가 (+49) |
| 백엔드 번역 키 수 (SMS) | ~26 | **26** | 계획 일치 |
| 총 번역 키 수 | ~221 | **270** | 프론트 244 + 백엔드 26 |
| 총 번역 문자열 수 (키 × 7) | ~1,547 | **1,890** | 270 × 7 |
| 지원 언어 수 | 7 | **7** | ko, en, ja, zh, fr, de, es |
| 마이그레이션된 페이지 수 | 12 | **10** | 9 페이지 + 1 레이아웃 (thumbnail.ts, 백엔드 API 에러는 차기 작업) |
| 신규 컴포넌트 | 3 | **3** | LanguageSwitcher, PhoneInput, LocaleBadge |

### 9.3 Phase별 구현 상세

#### Phase 1: 인프라 구축 ✅

생성/수정된 파일:

| 파일 | 역할 |
|------|------|
| `src/i18n/config.ts` | 지원 locale 목록, PortOne locale 매핑, 국가코드 매핑, 국기 이모지 |
| `src/i18n/request.ts` | 서버측 locale 해석 (쿠키 → Accept-Language → 영어 기본값) |
| `src/app/api/locale/route.ts` | POST /api/locale — 언어 전환 API, NEXT_LOCALE 쿠키 설정 (1년) |
| `src/components/LanguageSwitcher.tsx` | 언어 드롭다운 UI (홈 헤더에 배치) |
| `src/components/LocaleBadge.tsx` | 관리자/배달원용 언어 배지 (국기 + 코드, 한국어=녹색/외국어=노란색) |
| `next.config.js` | `withNextIntl` 플러그인 래핑 |
| `src/app/layout.tsx` | `NextIntlClientProvider` 래퍼, 동적 locale `<html lang>` 설정 |

#### Phase 2: 번역 파일 작성 ✅

**프론트엔드** (`src/i18n/messages/`):

| 파일 | 키 수 | 상태 |
|------|:-----:|:----:|
| `ko.json` | 244 | ✅ |
| `en.json` | 244 | ✅ |
| `ja.json` | 244 | ✅ |
| `zh.json` | 244 | ✅ |
| `fr.json` | 244 | ✅ |
| `de.json` | 244 | ✅ |
| `es.json` | 244 | ✅ |

번역 섹션 구조 (18개 최상위 섹션):
`common`, `home`, `restaurant`, `store`, `checkout` (하위 `alert` 포함), `checkoutComplete`, `confirm`, `cancel`, `myOrders`, `orderDetail`, `orderStatus`, `foodCategory`, `footer`, `language`, `phone`, `apiError`, `sms`, `goToMain`

**백엔드** (`backend/src/i18n/messages/`):

| 파일 | 키 수 | 상태 |
|------|:-----:|:----:|
| 7개 언어 파일 | 각 26 | ✅ |

백엔드 번역은 `sms` 섹션만 포함 (SMS 발송용).

#### Phase 3: 페이지 마이그레이션 ✅

| 페이지 | 파일 | 주요 변경사항 |
|--------|------|---------------|
| 홈 | `page.tsx` | `useTranslations`, `LanguageSwitcher` 추가, ~25개 문자열 교체 |
| 식당 상세 | `restaurant/[id]/page.tsx` | `useTranslations`, ~11개 문자열, 영업시간/전화 라벨 |
| 편의점 상세 | `store/[id]/page.tsx` | `useTranslations`, `translatedCategories` 배열 생성, 연령인증 모달 번역 |
| 결제 | `checkout/page.tsx` | `useTranslations`, `useLocale`, `PhoneInput`, `getPortOneLocale()`, ~48개 문자열, `locale` 전송 |
| 결제 완료 | `checkout/complete/page.tsx` | `useTranslations`, `useLocale`, ~14개 문자열, `locale` 전송 |
| 내 주문 | `my-orders/page.tsx` | `useTranslations`, `PhoneInput`, `getStatusLabel()` 함수, 상태 스텝 라벨 |
| 주문 상세 | `order/[id]/page.tsx` | `useTranslations`, `getStatusLabel()` 함수, 메모/시간 라벨 |
| 주문 확인 | `confirm/[token]/page.tsx` | `useTranslations`, ~12개 문자열 |
| 주문 취소 | `cancel/[token]/page.tsx` | `useTranslations`, ~11개 문자열, 환불 관련 |
| 레이아웃 | `layout.tsx` | `getTranslations('footer')`, 동적 metadata, `<html lang={locale}>` |

**신규 컴포넌트**:

| 컴포넌트 | 파일 | 기능 |
|----------|------|------|
| `PhoneInput` | `src/components/PhoneInput.tsx` | 국가코드 드롭다운 + E.164 출력, 17개국 지원, locale 기반 기본국가 |
| `LanguageSwitcher` | `src/components/LanguageSwitcher.tsx` | 7개 언어 드롭다운, /api/locale + router.refresh() |
| `LocaleBadge` | `src/components/LocaleBadge.tsx` | 국기 + locale 코드 배지, 색상 구분 |

**PortOne 결제창 다국어화**:
- `checkout/page.tsx`에서 `useLocale()` → `getPortOneLocale(locale)` → 결제 파라미터에 `locale` 포함
- 폴백: 미지원 locale은 `EN_US`로 폴백

#### Phase 4: 백엔드 다국어화 ✅

| 항목 | 파일 | 변경 내용 |
|------|------|-----------|
| i18n 모듈 | `backend/src/i18n/index.ts` | `t(locale, key, params)` 함수, dot-notation 키 해석, locale → en → ko 폴백 |
| SMS 서비스 | `backend/src/services/SMSService.ts` | 5개 메서드에 `locale` 파라미터 추가 (default 'ko') |
| 주문 라우트 | `backend/src/routes/order.routes.ts` | `locale` 필드를 req.body에서 추출, 주문 생성에 전달 |
| 주문 서비스 | `backend/src/services/OrderService.ts` | `CreateOrderInput`에 `locale?: string` 추가 |
| DB 스키마 | `backend/prisma/schema.prisma` | `Order` 모델에 `locale String @default("ko")` 추가 |
| 마이그레이션 | `prisma/migrations/20260404_add_locale_to_orders/` | `ALTER TABLE orders ADD COLUMN locale VARCHAR DEFAULT 'ko'` |

### 9.4 주요 기술 결정사항

| 결정 | 이유 |
|------|------|
| URL prefix 미사용 (쿠키 기반) | SMS 링크 호환성 유지 |
| 기본 언어 = 영어(en) | 외국인 관광객 대상, Accept-Language 미지원 시 영어가 가장 범용적 |
| 통화 ₩(KRW) 전 언어 통일 | 모든 결제가 KRW로만 이루어짐 |
| PhoneInput에 libphonenumber-js 미사용 | 직접 구현으로 번들 크기 절감 (~150KB 절약), 17개 주요 국가 하드코딩 |
| 백엔드 i18n은 자체 t() 함수 | next-intl은 프론트엔드 전용, 백엔드는 경량 자체 구현으로 충분 |
| STATUS_LABELS를 getStatusLabel() 함수로 변환 | 컴포넌트 외부 상수에서는 t() 훅 사용 불가 |

### 9.5 검증 단계에서 발견된 누락 및 추가된 키 목록

Phase 3 마이그레이션 후 전수 검증에서 발견된 누락 항목 (~20개 키):

| 키 | 섹션 | 추가 이유 |
|-----|------|-----------|
| `store.outOfStockShort` | store | 품절 배지 축약 텍스트 |
| `store.stockRemaining` | store | 재고 N개 남음 배지 |
| `store.stockLimit` | store | 최대 구매 수량 alert |
| `store.teenRestricted` | store | 미성년자 제한 상품 |
| `store.ageVerificationRequired` | store | 연령인증 모달 제목 |
| `store.ageVerificationDesc` | store | 연령인증 설명 |
| `store.ageVerificationQuestion` | store | 연령인증 질문 |
| `store.ageNo` / `store.ageYes` | store | 연령인증 버튼 |
| `store.products` | store | 상품 목록 제목 |
| `common.phone` | common | 전화번호 라벨 |
| `common.subtotal` | common | 소계 라벨 |
| `orderDetail.customerMemo` | orderDetail | 고객 메모 |
| `orderDetail.restaurantMemo` | orderDetail | 업체 메모 |
| `orderDetail.orderTime` | orderDetail | 주문 시간 |
| `myOrders.orderDate` | myOrders | 주문 날짜 |
| `myOrders.statusOrder` ~ `statusComplete` | myOrders | 상태 스텝 라벨 5개 |

### 9.6 미구현 항목 (차기 작업 대상)

| 항목 | 우선순위 | 비고 |
|------|:--------:|------|
| `utils/thumbnail.ts` 카테고리 매핑 다국어화 | 중간 | SVG 생성시 한국어 카테고리 regex 유지, 사용자에게 직접 노출 빈도 낮음 |
| 백엔드 API 에러 메시지 다국어화 | 중간 | apiError 번역 키는 준비됨, 라우트 코드에 적용 필요 |
| 관리자/배달원 페이지에 LocaleBadge 적용 | 낮음 | 컴포넌트 생성 완료, 실제 페이지 삽입은 해당 페이지 수정 시 |
| libphonenumber-js 기반 PhoneInput 고도화 | 낮음 | 현재 17개국 하드코딩 방식으로 충분히 동작 |
| SMS 국제 발송 설정 (Naver SENS) | 높음 | 해외 번호 SMS 발송 시 별도 설정 및 요금 확인 필요 |
| 기존 DB 전화번호 E.164 마이그레이션 | 높음 | `UPDATE users SET phone = '+82' || phone WHERE phone NOT LIKE '+%'` |
