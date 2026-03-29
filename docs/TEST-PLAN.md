# 한경 음식배달 서비스 테스트 계획서

## 테스트 환경 구성

### 필수 환경변수 (.env)

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/hangkyeong_delivery"

# JWT
JWT_SECRET="test-jwt-secret-key-12345"

# Frontend URL
FRONTEND_URL="http://localhost:3000"

# SMS (알리고)
ALIGO_API_KEY="test_api_key"
ALIGO_USER_ID="test_user"
ALIGO_SENDER="0212345678"

# Naver Map
NAVER_CLIENT_ID="test_client_id"
NAVER_CLIENT_SECRET="test_client_secret"

# PortOne (테스트)
PORTONE_API_KEY="test_api_key"
PORTONE_API_SECRET="test_secret"
PORTONE_MERCHANT_ID="test_merchant"
```

### 테스트 데이터 준비

```sql
-- 테스트 사용자
INSERT INTO users (phone, name) VALUES 
('010-1234-5678', '테스트고객'),
('010-8765-4321', '테스트고객2');

-- 테스트 식당 (이미 수집되었다고 가정)
INSERT INTO restaurants (naver_place_id, name, address, latitude, longitude, is_active, is_deliverable)
VALUES 
('test_001', '테스트식당1', '서울 강남구 강남대로 100', 37.497942, 127.027621, true, true),
('test_002', '테스트식당2', '서울 마포구 와우산로 50', 37.556317, 126.923058, true, true);

-- 테스트 메뉴
INSERT INTO menus (restaurant_id, name, price, is_available)
SELECT id, '테스트음식1', 10000, true FROM restaurants WHERE naver_place_id = 'test_001'
UNION ALL
SELECT id, '테스트음어2', 15000, true FROM restaurants WHERE naver_place_id = 'test_001'
UNION ALL
SELECT id, '테스트음식3', 8000, true FROM restaurants WHERE naver_place_id = 'test_002';

-- 영업시간 설정
INSERT INTO settings (key, value, type) VALUES
('business_hours', '{"openTime": "09:00", "closeTime": "22:00", "closedDays": [], "isHoliday": false}', 'business_hours'),
('delivery_config', '{"baseFee": 3000, "perKmFee": 500, "maxDistance": 5.0}', 'delivery');
```

---

## 테스트 시나리오

### TC-01: ARS/SMS 연결 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-01 |
| **기능** | 전화 수신 시 SMS 발송 |
| **전제조건** | 알리고 API 연동 완료, 웹훅 설정 완료 |
| **테스트步骤** | 1. 알리고 웹훅 URL 확인 (`POST /webhooks/sms`)<br>2. 테스트 전화번호로 SMS 전송 시뮬레이션<br>3. 발신번호가 데이터베이스에 저장/조회되는지 확인 |
| **예상결과** | - 사용자가 최초 방문 시 Users 테이블에_phone으로 사용자 생성<br>- SMS 발송 로그 확인 |
| **검증방법** | `SELECT * FROM users WHERE phone = '010-xxx-xxxx';` |

### TC-02: 영업시간 - 영업중 페이지

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-02 |
| **기능** | 영업시간 내에 접속 시 정상 페이지 표시 |
| **전제조건** | business_hours 설정이 현재 시간 포함 |
| **테스트步骤** | 1. 현재 시간이 09:00~22:00 이내인지 확인<br>2. `GET /api/v1/settings/business-hours` 호출<br>3. `isOpen: true` 응답 확인<br>4. 프론트엔드에서 `/restaurants` 페이지 접근 |
| **예상결과** | `{"success": true, "data": {"isOpen": true}}` |
| **검증방법** | - API 응답 확인<br>- 배달 가능한 식당 목록 표시 |

### TC-03: 영업시간 - 종료 페이지

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-03 |
| **기능** | 영업시간 외 접속 시 종료 페이지 표시 |
| **전제조건** | business_hours 설정이 현재 시간 포함 안함 |
| **테스트步骤** | 1. business_hours를 `"openTime": "23:00", "closeTime": "23:59"`로 설정<br>2. `GET /api/v1/settings/business-hours` 호출<br>3. `isOpen: false` 응답 확인<br>4. `/closed` 페이지 리다이렉션 확인 |
| **예상결과** | `{"success": true, "data": {"isOpen": false, "message": "영업시간은 09:00 ~ 22:00입니다."}}` |
| **검증방법** | - API 응답 확인<br>- 종료 안내 페이지 표시 |

### TC-04: 식당 목록 조회

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-04 |
| **기능** | 배달 가능한 식당 목록 조회 |
| **전제조건** | 테스트 데이터 (식당, 메뉴) 삽입 완료 |
| **테스트步骤** | 1. `GET /api/v1/restaurants` 호출<br>2. 위도/경도 파라미터 추가: `?lat=37.5&lng=127.0`<br>3. 응답에서 distance, deliveryFee 포함 확인 |
| **예상결과** | ```json<br>{<br>  "success": true,<br>  "data": [<br>    {<br>      "id": "...",<br>      "name": "테스트식당1",<br>      "distance": 1.2,<br>      "deliveryFee": 3000,<br>      "is_open": true<br>    }<br>  ]<br>}<br>``` |
| **검증방법** | - 필터링: is_active=true, is_deliverable=true만 표시<br>- 거리 계산: Haversine 공식을 통한 distance 포함 |

### TC-05: 식당 상세 및 메뉴 조회

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-05 |
| **기능** | 식당 상세 정보 및 메뉴 목록 조회 |
| **전제조건** | 테스트 메뉴 데이터 존재 |
| **테스트步骤** | 1. `GET /api/v1/restaurants/{restaurantId}`<br>2. `GET /api/v1/restaurants/{restaurantId}/menus` |
| **예상결과** | - 식당 정보 (주소, 전화번호, 평점)<br>- 메뉴 목록 (is_available=true만) |
| **검증메서드** | - 비활성화된 메뉴는 응답에서 제외 |

### TC-06: 배달비 계산

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-06 |
| **기능** | 거리 기반 배달비 계산 |
| **전제조건** | DeliveryFeeService 정상 동작 |
| **테스트步骤** | 1. 식당 좌표: (37.497942, 127.027621) - 강남역<br>2. 고객 좌표: (37.5117, 127.0200) - 논현역<br>3. `GET /api/v1/delivery/fee?restaurantId=...&lat=37.5117&lng=127.0200` |
| **예상결과** | ```json<br>{<br>  "distance": 1.55,<br>  "deliveryFee": 3000,<br>  "isDeliverable": true<br>}<br>``` |
| **검증메서드** | - 2km 이내: 기본 3,000원<br>- 2km 초과: km당 +500원 |

### TC-07: 주문 생성 (온라인 결제 스킵)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-07 |
| **기능** | 고객 주문 요청 생성 |
| **전제조건** | 사용자 인증 (전화번호), 메뉴 선택 |
| **테스트步骤** | 1. 테스트용 JWT 토큰 획득 (전화번호 인증 시뮬레이션)<br>2. `POST /api/v1/orders` 호출<br>```json<br>{<br>  "restaurantId": "test_001",<br>  "items": [{"menuId": "menu_001", "quantity": 2}],<br>  "deliveryAddress": "서울 강남구 테헤란로 100",<br>  "deliveryLat": 37.5117,<br>  "deliveryLng": 127.0200<br>}<br>``` |
| **예상결과** | - 주문 번호 생성 (형식: YYYYMMDDXXXXXX)<br>- 상태: `pending`<br>- SMS 발송 ("주문이 요청되었습니다") |
| **검증메서드** | 1. `SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;`<br>2. status = 'pending' 확인 |

### TC-08: 관리자 - 주문 목록 조회

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-08 |
| **기능** | 관리자가 주문 목록 조회 |
| **전제조건** | TC-07 주문 생성 완료 |
| **테스트步骤** | 1. `GET /api/v1/admin/orders?status=pending`<br>2. `GET /api/v1/admin/dashboard` |
| **예상결과** | - 상태별 주문 목록<br>- 대시보드 통계 (pending, pending_confirmation 등) |
| **검증메서드** | - `GET /admin/orders` 페이지에서 목록 표시 확인 |

### TC-09: 관리자 - 픽업 시간 설정

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-09 |
| **기능** | 관리자가 픽업 가능 시간 설정 후 고객에게 SMS 발송 |
| **전제조건** | TC-07 주문이 'pending' 상태 |
| **테스트步骤** | 1. `PUT /api/v1/orders/{orderId}/pickup-time`<br>```json<br>{<br>  "pickupTime": "2024-03-25T14:30:00Z",<br>  "restaurantMemo": "빨리 준비해달라고 요청했습니다"<br>}<br>``` |
| **예상결과** | 1. 주문 상태: `pending_confirmation`<br>2. confirm_token 생성<br>3. SMS 발송 (확정/취소 링크 포함)<br>4. `SELECT confirm_token FROM orders WHERE id = '...';` |
| **검증메서드** | 1. SMS 내용 확인 (링크 포함)<br>2. DB에서 confirm_token, estimated_pickup_time 확인 |

### TC-10: 고객 - 주문 확정

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-10 |
| **기능** | 고객이 SMS 링크를 통해 주문 확정 |
| **전제조건** | TC-09 완료, confirm_token 존재 |
| **테스트步骤** | 1. SMS의 확정 링크 접근: `POST /api/v1/orders/confirm/{token}`<br>2. 또는 프론트엔드: `POST /api/v1/orders/confirm/{token}` |
| **예상결과** | 1. 주문 상태: `order_confirmed`<br>2. confirmed_at = 현재 시간<br>3. confirm_token = null (소멸)<br>4. SMS 발송 ("주문이 확정되었습니다") |
| **검증메서드** | `SELECT status, confirmed_at FROM orders WHERE order_number = '...';` |

### TC-11: 고객 - 주문 취소

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-11 |
| **기능** | 고객이 SMS 링크를 통해 주문 취소 |
| **전제조건** | TC-09 완료, confirm_token 존재 |
| **테스트步骤** | 1. SMS의 취소 링크 접근: `POST /api/v1/orders/cancel/{token}` |
| **예상결과** | 1. 주문 상태: `cancelled`<br>2. cancelled_at = 현재 시간<br>3. cancel_reason = "Customer cancelled during confirmation"<br>4. SMS 발송 ("주문이 취소되었습니다") |
| **검증메서드** | `SELECT status, cancelled_at, cancel_reason FROM orders;` |

### TC-12: 관리자 - 픽업 완료 (실물 카드)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-12 |
| **기능** | 배달원이 식당에서 실물 카드로 결제 후 픽업 완료 처리 |
| **전제조건** | TC-10 주문 확정 완료 (order_confirmed) |
| **테스트步骤** | 1. `POST /api/v1/orders/{orderId}/pickup`<br>```json<br>{<br>  "restaurantPaidAmount": 20000<br>}<br>``` |
| **예상결과** | 1. 주문 상태: `picked_up`<br>2. restaurant_paid_amount = 20000<br>3. restaurant_paid_at = 현재 시간<br>4. pickup_time = 현재 시간<br>5. SMS 발송 ("픽업되었습니다") |
| **검증메서드** | `SELECT status, restaurant_paid_amount, pickup_time FROM orders;` |

### TC-13: 관리자 - 배달 시작

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-13 |
| **기능** | 픽업 후 배달 시작 |
| **전제조건** | TC-12 픽업 완료 |
| **테스트步骤** | 1. `PUT /api/v1/orders/{orderId}/delivering` |
| **예상결과** | 1. 주문 상태: `delivering`<br>2. SMS 발송 ("배달 중입니다") |
| **검증메서드** | `SELECT status FROM orders;` |

### TC-14: 관리자 - 배달 완료

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-14 |
| **기능** | 고객에게 배달 완료 |
| **전제조건** | TC-13 배달 중 |
| **테스트步骤** | 1. `PUT /api/v1/orders/{orderId}/complete` |
| **예상결과** | 1. 주문 상태: `completed`<br>2. delivered_at = 현재 시간<br>3. SMS 발송 ("배달이 완료되었습니다") |
| **검증메서드** | `SELECT status, delivered_at FROM orders;` |

### TC-15: 관리자 - 식당 활성화/비활성화

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-15 |
| **기능** | 식당 노출/비노출 전환 |
| **전제조건** | 테스트 식당 존재 |
| **테스트步骤** | 1. `PUT /api/v1/admin/restaurants/{restaurantId}`<br>```json<br>{ "isActive": false }<br>```<br>2. `GET /api/v1/restaurants` 재호출 |
| **예상결과** | - isActive=false인 식당은 목록에서 제외 |
| **검증메서드** | - 비활성화된 식당은 사용자에게 표시 안됨 |

### TC-16: 관리자 - 메뉴 활성화/비활성화

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-16 |
| **기능** | 메뉴의 주문 가능 여부 전환 |
| **전제조건** | 테스트 메뉴 존재 |
| **테스트步骤** | 1. `PUT /api/v1/admin/menus/{menuId}`<br>```json<br>{ "isAvailable": false }<br>```<br>2. `GET /api/v1/restaurants/{restaurantId}/menus` |
| **예상결과** | - isAvailable=false인 메뉴는 목록에서 제외 |
| **검증메서드** | - 고객이 주문 불가 메뉴 선택 불가 |

### TC-17: 관리자 - 메뉴 추가/수정

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-17 |
| **기능** | 식당 메뉴 추가 및 정보 수정 |
| **전제조건** | 테스트 식당 존재 |
| **테스트步骤** | 1. 메뉴 추가: `POST /api/v1/admin/menus`<br>```json<br>{<br>  "restaurantId": "...",<br>  "name": "새로운메뉴",<br>  "price": 12000,<br>  "description": "맛있는 메뉴"<br>}<br>```<br>2. 메뉴 수정: `PUT /api/v1/admin/menus/{menuId}`<br>```json<br>{ "name": "수정된메뉴", "price": 15000 }<br>``` |
| **예상결과** | - 새 메뉴 등록됨<br>- 메뉴 정보 업데이트됨 |
| **검증메서드** | `SELECT * FROM menus WHERE restaurant_id = '...';` |

### TC-18: 관리자 - 데이터 스크랩

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-18 |
| **기능** | 행정구역별 네이버 지도 데이터 수집 |
| **전제조건** | 네이버 API 설정 완료 |
| **테스트步骤** | 1. `POST /api/v1/admin/scrape`<br>```json<br>{ "area": "서울 강남구" }<br>```<br>2. 응답 확인<br>3. `SELECT COUNT(*) FROM restaurants;` |
| **예상결과** | - 응답: `{"success": true, "syncedCount": 10}`<br>- restaurants 테이블에 데이터 삽입 |
| **검증메서드** | - 수집된 식당 수 확인<br>- 메뉴 데이터 포함 여부 |

### TC-19: 관리자 - 영업시간 설정

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-19 |
| **기능** | 영업시간, 휴일 설정 |
| **전제조건** | 설정 테이블 존재 |
| **테스트步骤** | 1. `PUT /api/v1/admin/settings`<br>```json<br>{<br>  "key": "business_hours",<br>  "value": {<br>    "openTime": "10:00",<br>    "closeTime": "21:00",<br>    "closedDays": ["sunday"],<br>    "isHoliday": false<br>  }<br>}<br>``` |
| **예상결과** | - 설정 저장됨<br>- 새로운 시간대에 isOpen 변경됨 |
| **검증메서드** | `SELECT * FROM settings WHERE key = 'business_hours';` |

### TC-20: 관리자 - 배달비 설정

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-20 |
| **기능** | 배달비 정책 설정 |
| **전제조건** | 설정 테이블 존재 |
| **테스트步骤** | 1. `PUT /api/v1/admin/settings`<br>```json<br>{<br>  "key": "delivery_config",<br>  "value": {<br>    "baseFee": 2500,<br>    "perKmFee": 400,<br>    "maxDistance": 7.0<br>  }<br>}<br>```<br>2. 배달비 재계산 확인 |
| **예상결과** | - 설정 저장됨<br>- 새로운 계산공식 적용 |
| **검증메서드** | - 거리별 배달비 다시 계산 시 새 정책 적용 |

---

## 테스트 실행 체크리스트

### Phase 1: 기본 기능 (TC-01 ~ TC-06)

- [ ] TC-01: ARS/SMS 연결
- [ ] TC-02: 영업시간 - 영업중
- [ ] TC-03: 영업시간 - 종료
- [ ] TC-04: 식당 목록 조회
- [ ] TC-05: 메뉴 조회
- [ ] TC-06: 배달비 계산

### Phase 2: 주문 플로우 (TC-07 ~ TC-14)

- [ ] TC-07: 주문 생성
- [ ] TC-08: 주문 목록 조회
- [ ] TC-09: 픽업 시간 설정
- [ ] TC-10: 주문 확정
- [ ] TC-11: 주문 취소
- [ ] TC-12: 픽업 완료
- [ ] TC-13: 배달 시작
- [ ] TC-14: 배달 완료

### Phase 3: 관리자 기능 (TC-15 ~ TC-20)

- [ ] TC-15: 식당 활성화/비활성화
- [ ] TC-16: 메뉴 활성화/비활성화
- [ ] TC-17: 메뉴 추가/수정
- [ ] TC-18: 데이터 스크랩
- [ ] TC-19: 영업시간 설정
- [ ] TC-20: 배달비 설정

---

## 테스트 계정

| 역할 | 전화번호 | 용도 |
|------|----------|------|
| 고객1 | 010-1234-5678 | 일반 주문 테스트 |
| 고객2 | 010-8765-4321 | 취소 테스트 |
| 관리자 | - | Admin 페이지 접근 |

---

## API 테스트 명령어 (cURL)

```bash
# 1. 영업시간 확인
curl -X GET http://localhost:3000/api/v1/settings/business-hours

# 2. 식당 목록
curl -X GET "http://localhost:3000/api/v1/restaurants?lat=37.5&lng=127.0"

# 3. 배달비 계산
curl -X GET "http://localhost:3000/api/v1/delivery/fee?restaurantId=xxx&lat=37.5&lng=127.0"

# 4. 주문 생성
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"xxx","items":[{"menuId":"xxx","quantity":2}],"deliveryAddress":"서울","deliveryLat":37.5,"deliveryLng":127.0}'

# 5. 픽업 시간 설정
curl -X PUT http://localhost:3000/api/v1/orders/{orderId}/pickup-time \
  -H "Content-Type: application/json" \
  -d '{"pickupTime":"2024-03-25T14:30:00Z"}'

# 6. 주문 확정
curl -X POST http://localhost:3000/api/v1/orders/confirm/{token}

# 7. 주문 취소
curl -X POST http://localhost:3000/api/v1/orders/cancel/{token}

# 8. 픽업 완료
curl -X POST http://localhost:3000/api/v1/orders/{orderId}/pickup \
  -H "Content-Type: application/json" \
  -d '{"restaurantPaidAmount":20000}'

# 9. 배달 시작
curl -X PUT http://localhost:3000/api/v1/orders/{orderId}/delivering

# 10. 배달 완료
curl -X PUT http://localhost:3000/api/v1/orders/{orderId}/complete

# 11. 관리자 - 주문 목록
curl -X GET http://localhost:3000/api/v1/admin/orders?status=pending

# 12. 관리자 - 대시보드
curl -X GET http://localhost:3000/api/v1/admin/dashboard

# 13. 관리자 - 식당 목록
curl -X GET http://localhost:3000/api/v1/admin/restaurants

# 14. 관리자 - 식당 비활성화
curl -X PUT http://localhost:3000/api/v1/admin/restaurants/{id} \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}'

# 15. 관리자 - 메뉴 비활성화
curl -X PUT http://localhost:3000/api/v1/admin/menus/{id} \
  -H "Content-Type: application/json" \
  -d '{"isAvailable":false}'

# 16. 관리자 - 데이터 스크랩
curl -X POST http://localhost:3000/api/v1/admin/scrape \
  -H "Content-Type: application/json" \
  -d '{"area":"서울 강남구"}'

# 17. 관리자 - 설정 저장
curl -X PUT http://localhost:3000/api/v1/admin/settings \
  -H "Content-Type: application/json" \
  -d '{"key":"business_hours","value":{"openTime":"09:00","closeTime":"22:00","closedDays":[],"isHoliday":false}}'
```

---

## 예상 테스트 결과 요약

| 구분 | 통과 | 실패 | 비고 |
|------|------|------|------|
| Phase 1 | - | - | |
| Phase 2 | - | - | |
| Phase 3 | - | - | |
| **총계** | **/20** | **/20** | |
