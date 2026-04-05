# HKD 복수 식당 픽업 추적(Multi-Restaurant Pickup Tracking) 설계서

> 작성일: 2026-04-04
> 상태: ✅ 구현 완료

---

## 1. 개요

### 1.1 배경

한경배달 플랫폼에서는 고객이 여러 식당의 메뉴를 한 번에 주문할 수 있다. 현재 체크아웃 시 식당별로 개별 주문(Order)이 생성되지만, 이들이 동일 배달 건에 속한다는 정보가 DB에 명시적으로 기록되지 않는다. 또한 '픽업 중' 상태에서 어느 식당의 음식이 이미 픽업되었는지 고객이 알 수 없다.

### 1.2 목표

- 복수 식당 주문을 `deliveryGroupId`로 명시적으로 그룹화
- '픽업 중' 상태를 식당별 하위 단계로 세분화
- 각 식당 픽업 완료 시 고객에게 진행률 포함 SMS 발송
- 프론트엔드에서 식당별 픽업 진행률을 시각적으로 표시
- 모든 SMS는 7개 언어(ko, en, ja, zh, fr, de, es)로 다국어 지원

---

## 2. 현재 구조 분석

### 2.1 복수 식당 주문 흐름 (현재)

```
체크아웃 → PortOne 결제 → 식당별 Order 생성 (N개)
          └─ 모두 같은 deliveryAddress, deliveryLat/Lng
          └─ 첫 번째 식당에 전체 배달비 할당, 나머지 0
```

### 2.2 상태 전이 (현재)

```
pending → pending_confirmation → order_confirmed → picked_up → delivering → completed
                                                                            → cancelled
```

문제: `picked_up` 상태에서 어떤 식당이 픽업되었는지 구분 불가. 모든 식당이 한꺼번에 `picked_up`으로 전환되지 않으면 중간 상태를 추적할 수 없음.

### 2.3 프론트엔드 그룹핑 (현재)

`my-orders` 페이지에서 배달 주소 + 1분 이내 시간 버킷으로 주문을 그룹화하여 표시. 하지만 이는 UI 레벨의 추정 기반 그룹핑으로, 정확하지 않을 수 있음.

---

## 3. 기술 설계

### 3.1 DB 스키마 변경

**Order 모델에 `deliveryGroupId` 추가:**

```prisma
model Order {
  // ... 기존 필드 ...
  deliveryGroupId  String?  @map("delivery_group_id")

  @@index([deliveryGroupId])
}
```

- `deliveryGroupId`: 같은 배달 건의 주문들을 묶는 UUID. 단일 식당 주문은 `null`.
- 체크아웃 시 복수 식당 주문이면 프론트엔드에서 UUID를 생성하여 모든 주문에 동일 값 전달.

**마이그레이션:**

```sql
ALTER TABLE orders ADD COLUMN delivery_group_id VARCHAR;
CREATE INDEX idx_orders_delivery_group_id ON orders(delivery_group_id);
```

### 3.2 주문 생성 흐름 변경

**프론트엔드 (checkout/page.tsx):**

```typescript
// 복수 식당 주문 시 deliveryGroupId 생성
const restaurantIds = Object.keys(cartData);
const deliveryGroupId = restaurantIds.length > 1 ? crypto.randomUUID() : undefined;

// 각 식당별 주문 생성 시 deliveryGroupId 전달
const orderData = {
  ...existingFields,
  deliveryGroupId,
};
```

**백엔드 (OrderService):**
- `CreateOrderInput`에 `deliveryGroupId?: string` 추가
- `createOrderWithPayment()`에서 DB에 저장

### 3.3 식당별 픽업 SMS 로직

**핵심 로직 (`OrderService.markAsPickedUp` 수정):**

```typescript
async markAsPickedUp(orderId, restaurantPaidAmount) {
  // 1. 해당 주문을 picked_up 으로 업데이트
  const updatedOrder = await prisma.order.update({ ... });

  // 2. deliveryGroupId가 있으면 → 복수 식당 주문
  if (updatedOrder.deliveryGroupId) {
    const groupOrders = await prisma.order.findMany({
      where: { deliveryGroupId: updatedOrder.deliveryGroupId },
      include: { restaurant: true },
    });

    const totalCount = groupOrders.length;
    const pickedUpCount = groupOrders.filter(o =>
      ['picked_up', 'delivering', 'completed'].includes(o.status)
    ).length;
    const remaining = totalCount - pickedUpCount;

    // 3. 식당별 픽업 SMS (진행률 포함)
    if (remaining > 0) {
      // 중간 픽업: "치킨집 픽업 완료 (2/3 식당). 나머지 1곳 픽업 후 배달 시작합니다."
      sendPartialPickupSMS(phone, restaurantName, pickedUpCount, totalCount, remaining, locale);
    } else {
      // 전체 픽업 완료: "모든 식당 픽업 완료 (3/3). 배달을 시작합니다."
      sendAllPickedUpSMS(phone, pickedUpCount, totalCount, locale);
    }
  } else {
    // 단일 식당 → 기존 SMS 유지
    sendPickedUpSMS(phone, orderNumber, locale);
  }
}
```

### 3.4 SMS 템플릿

**식당별 픽업 (중간 단계):**

| 언어 | 메시지 |
|------|--------|
| ko | `[한경배달] {restaurantName} 픽업 완료 ({pickedUp}/{total} 식당)\n나머지 {remaining}곳 픽업 후 배달 시작합니다.` |
| en | `[HKD] {restaurantName} picked up ({pickedUp}/{total} restaurants)\n{remaining} more pickup(s) before delivery begins.` |
| ja | `[HKD] {restaurantName} ピックアップ完了 ({pickedUp}/{total}店舗)\n残り{remaining}店舗のピックアップ後、配達を開始します。` |
| zh | `[HKD] {restaurantName} 已取餐 ({pickedUp}/{total}家餐厅)\n剩余{remaining}家取餐后开始配送。` |
| fr | `[HKD] {restaurantName} récupéré ({pickedUp}/{total} restaurants)\nEncore {remaining} à récupérer avant la livraison.` |
| de | `[HKD] {restaurantName} abgeholt ({pickedUp}/{total} Restaurants)\nNoch {remaining} Abholung(en) vor der Lieferung.` |
| es | `[HKD] {restaurantName} recogido ({pickedUp}/{total} restaurantes)\n{remaining} recogida(s) más antes del envío.` |

**전체 픽업 완료:**

| 언어 | 메시지 |
|------|--------|
| ko | `[한경배달] 모든 식당 픽업 완료 ({total}/{total})\n배달을 시작합니다!` |
| en | `[HKD] All restaurants picked up ({total}/{total})\nDelivery is starting!` |

### 3.5 프론트엔드 — 주문 추적 페이지

**API 응답 확장:**
- `GET /api/v1/orders/:id` 응답에 `deliveryGroup` 정보 추가:

```json
{
  "data": {
    "id": "...",
    "deliveryGroupId": "uuid",
    "deliveryGroup": {
      "totalOrders": 3,
      "pickedUpOrders": 2,
      "orders": [
        { "restaurantName": "치킨집", "status": "picked_up" },
        { "restaurantName": "피자집", "status": "picked_up" },
        { "restaurantName": "중국집", "status": "order_confirmed" }
      ]
    }
  }
}
```

**UI 컴포넌트:**
- 픽업 진행률 바 (2/3)
- 식당별 체크리스트 (✅ 치킨집, ✅ 피자집, ⏳ 중국집)
- `picked_up` 상태에서만 표시

### 3.6 admin.routes.ts — 관리자 상태 전환

`picking_up → delivering` 전환 시, deliveryGroupId가 있는 경우:
- 해당 그룹의 모든 주문이 `picked_up` 이상인지 검증
- 그룹 내 전체 주문을 일괄 `delivering`으로 전환

---

## 4. 변경 파일 목록

| 영역 | 파일 | 변경 내용 |
|------|------|-----------|
| DB | `prisma/schema.prisma` | Order 모델에 `deliveryGroupId` + index 추가 |
| DB | `prisma/migrations/20260404_add_delivery_group_id/migration.sql` | ALTER TABLE |
| Backend | `src/services/OrderService.ts` | `deliveryGroupId` 저장, 픽업 진행률 추적, 그룹 픽업 SMS |
| Backend | `src/routes/order.routes.ts` | `deliveryGroupId` req.body 처리, 주문 조회에 그룹 정보 포함 |
| Backend | `src/routes/admin.routes.ts` | 그룹 일괄 상태 전환, 식당별 픽업 SMS |
| Backend | `src/i18n/messages/*.json` (×7) | 식당별 픽업 SMS 템플릿 추가 |
| Frontend | `src/app/checkout/page.tsx` | `deliveryGroupId` 생성 및 전달 |
| Frontend | `src/app/order/[id]/page.tsx` | 식당별 픽업 진행률 UI |
| Frontend | `src/i18n/messages/*.json` (×7) | 픽업 진행률 번역 키 추가 |
