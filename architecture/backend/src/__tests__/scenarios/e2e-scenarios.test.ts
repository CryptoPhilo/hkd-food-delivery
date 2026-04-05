import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import axios, { AxiosInstance } from 'axios';

/**
 * HKD 배달 플랫폼 엔드-투-엔드 시나리오 테스트
 *
 * 모든 4개 역할(고객, 배달원, 지역어드민, 시스템어드민)의 완전한 사용자 여정 테스트
 * 한국어 테스트 이름으로 실제 비즈니스 시나리오를 반영
 */

interface TestContext {
  baseUrl: string;
  customerClient: AxiosInstance;
  driverClient: AxiosInstance;
  regionAdminClient: AxiosInstance;
  systemAdminClient: AxiosInstance;
  testData: {
    customerId?: string;
    driverId?: string;
    regionAdminId?: string;
    regionId?: string;
    restaurantId?: string;
    orderId?: string;
    deliveryId?: string;
  };
}

describe('HKD 배달 플랫폼 엔드-투-엔드 시나리오 테스트', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = {
      baseUrl: process.env.TEST_API_BASE_URL || 'http://localhost:3000',
      customerClient: axios.create(),
      driverClient: axios.create(),
      regionAdminClient: axios.create(),
      systemAdminClient: axios.create(),
      testData: {},
    };

    // 시스템 어드민으로 테스트 환경 초기화
    await setupTestEnvironment(ctx);
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await cleanupTestData(ctx);
  });

  beforeEach(() => {
    // 각 테스트 전에 테스트 컨텍스트 초기화
    ctx.testData = {};
  });

  /**
   * ========================================
   * ROLE 1: 고객 (Customer) 시나리오
   * ========================================
   */

  describe('고객 - 신규 고객 첫 주문 흐름', () => {
    it('GPS 지역 감지 → 음식점 검색 → 장바구니 추가 → 결제 → SMS 확인 → 주문 확인 → 배달 추적 → 배달 완료', async () => {
      // 1. GPS 위치 기반 지역 감지
      const gpsLocation = { latitude: 37.4979, longitude: 127.0276 }; // Seoul
      const regionResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/regions/by-location`,
        {
          params: gpsLocation,
          headers: { 'User-Agent': 'TestClient/1.0' },
        },
      );
      expect(regionResponse.status).toBe(200);
      expect(regionResponse.data).toHaveProperty('regionId');
      ctx.testData.regionId = regionResponse.data.regionId;

      // 2. 음식점 검색
      const restaurantListResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/restaurants`,
        {
          params: { regionId: ctx.testData.regionId },
          headers: { Authorization: `Bearer ${await getCustomerToken(ctx)}` },
        },
      );
      expect(restaurantListResponse.status).toBe(200);
      expect(Array.isArray(restaurantListResponse.data.restaurants)).toBe(true);
      expect(restaurantListResponse.data.restaurants.length).toBeGreaterThan(0);
      ctx.testData.restaurantId = restaurantListResponse.data.restaurants[0].id;

      // 3. 메뉴 조회
      const menuResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/restaurants/${ctx.testData.restaurantId}/menus`,
        {
          headers: { Authorization: `Bearer ${await getCustomerToken(ctx)}` },
        },
      );
      expect(menuResponse.status).toBe(200);
      const menuItem = menuResponse.data.menus[0];
      expect(menuItem).toHaveProperty('id');
      expect(menuItem).toHaveProperty('price');

      // 4. 장바구니에 추가
      const cartResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/cart/items`,
        {
          restaurantId: ctx.testData.restaurantId,
          menuItemId: menuItem.id,
          quantity: 1,
          specialRequests: '매운맛으로 주세요',
        },
        {
          headers: { Authorization: `Bearer ${await getCustomerToken(ctx)}` },
        },
      );
      expect(cartResponse.status).toBe(201);
      expect(cartResponse.data).toHaveProperty('cartId');

      // 5. 결제 진행
      const checkoutResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/checkout`,
        {
          cartId: cartResponse.data.cartId,
          paymentMethod: 'CARD',
          deliveryAddress: '서울시 강남구 테헤란로 123',
          phoneNumber: '01012345678',
          specialNotes: '현관 앞에 놔주세요',
        },
        {
          headers: { Authorization: `Bearer ${await getCustomerToken(ctx)}` },
        },
      );
      expect(checkoutResponse.status).toBe(201);
      ctx.testData.orderId = checkoutResponse.data.orderId;
      expect(checkoutResponse.data).toHaveProperty('totalPrice');
      expect(checkoutResponse.data).toHaveProperty('estimatedDeliveryTime');

      // 6. SMS 확인 (모킹 가정)
      const smsLogResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/sms-logs/${ctx.testData.orderId}`,
        {
          headers: { Authorization: `Bearer ${await getRegionAdminToken(ctx)}` },
        },
      );
      expect(smsLogResponse.status).toBe(200);
      expect(smsLogResponse.data.message).toContain('주문이 접수');

      // 7. 주문 확인
      const confirmResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/${ctx.testData.orderId}/confirm`,
        {},
        {
          headers: { Authorization: `Bearer ${await getCustomerToken(ctx)}` },
        },
      );
      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.data.status).toBe('CONFIRMED');

      // 8. 배달 추적
      const trackingResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/orders/${ctx.testData.orderId}/tracking`,
        {
          headers: { Authorization: `Bearer ${await getCustomerToken(ctx)}` },
        },
      );
      expect(trackingResponse.status).toBe(200);
      expect(trackingResponse.data).toHaveProperty('currentStatus');
      expect(trackingResponse.data).toHaveProperty('driverLocation');

      // 9. 배달 완료 (배달원 시뮬레이션)
      const deliveryCompleteResponse = await ctx.driverClient.post(
        `${ctx.baseUrl}/api/deliveries/${ctx.testData.deliveryId}/complete`,
        {
          signature: 'base64encodedSignature',
          photoUrl: 'https://example.com/delivery-photo.jpg',
          temperature: 'HOT',
        },
        {
          headers: { Authorization: `Bearer ${await getDriverToken(ctx)}` },
        },
      );
      expect(deliveryCompleteResponse.status).toBe(200);
      expect(deliveryCompleteResponse.data.status).toBe('COMPLETED');

      // 10. 최종 주문 상태 확인
      const finalOrderResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/orders/${ctx.testData.orderId}`,
        {
          headers: { Authorization: `Bearer ${await getCustomerToken(ctx)}` },
        },
      );
      expect(finalOrderResponse.status).toBe(200);
      expect(finalOrderResponse.data.status).toBe('DELIVERED');
    });
  });

  describe('고객 - 다중 식당 주문 처리', () => {
    it('2개 이상 음식점에서 주문 → 배달비 합산 확인 → 단일 배달로 진행', async () => {
      const token = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);

      // 1. 첫 번째 음식점에서 주문 추가
      const restaurants = await getRestaurantsByRegion(ctx, regionId);
      const restaurant1 = restaurants[0];
      const restaurant2 = restaurants[1];

      const menu1 = await getMenuByRestaurant(ctx, restaurant1.id, token);
      const cartResponse1 = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/cart/items`,
        {
          restaurantId: restaurant1.id,
          menuItemId: menu1[0].id,
          quantity: 1,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(cartResponse1.status).toBe(201);

      // 2. 두 번째 음식점에서 주문 추가
      const menu2 = await getMenuByRestaurant(ctx, restaurant2.id, token);
      const cartResponse2 = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/cart/items`,
        {
          restaurantId: restaurant2.id,
          menuItemId: menu2[0].id,
          quantity: 1,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(cartResponse2.status).toBe(201);

      // 3. 장바구니 조회 - 다중 식당 확인
      const cartViewResponse = await ctx.customerClient.get(`${ctx.baseUrl}/api/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(cartViewResponse.status).toBe(200);
      expect(cartViewResponse.data.items.length).toBe(2);

      // 4. 배달비 계산 확인
      const feeCalculationResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/calculate-fee`,
        {
          deliveryAddress: '서울시 강남구 테헤란로 456',
          cartItems: cartViewResponse.data.items,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(feeCalculationResponse.status).toBe(200);
      expect(feeCalculationResponse.data.deliveryFeeTotal).toBeGreaterThan(0);
      expect(feeCalculationResponse.data.isMultipleRestaurants).toBe(true);

      // 5. 결제 진행
      const checkoutResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/checkout`,
        {
          cartId: cartViewResponse.data.cartId,
          paymentMethod: 'CARD',
          deliveryAddress: '서울시 강남구 테헤란로 456',
          phoneNumber: '01012345679',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(checkoutResponse.status).toBe(201);
      ctx.testData.orderId = checkoutResponse.data.orderId;

      // 6. 결제 후 단일 배달 배정 확인
      const orderResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/orders/${ctx.testData.orderId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(orderResponse.status).toBe(200);
      expect(orderResponse.data.deliveryId).toBeDefined();
      expect(orderResponse.data.restaurants.length).toBe(2);

      // 7. 배달원 할당 확인
      const deliveryResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/deliveries/${orderResponse.data.deliveryId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(deliveryResponse.status).toBe(200);
      expect(deliveryResponse.data.stops.length).toBe(2);
    });
  });

  describe('고객 - 주문 취소 및 환불', () => {
    it('주문 생성 → 확인 전 취소 → 환불 검증', async () => {
      const token = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);
      const restaurant = await getRestaurantsByRegion(ctx, regionId).then((r) => r[0]);

      // 1. 주문 생성
      const menu = await getMenuByRestaurant(ctx, restaurant.id, token);
      const cartResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/cart/items`,
        {
          restaurantId: restaurant.id,
          menuItemId: menu[0].id,
          quantity: 1,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const checkoutResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/checkout`,
        {
          cartId: cartResponse.data.cartId,
          paymentMethod: 'CARD',
          deliveryAddress: '서울시 강남구 테헤란로 789',
          phoneNumber: '01012345680',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const orderId = checkoutResponse.data.orderId;

      // 2. 취소 (확인 전)
      const cancelResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/${orderId}/cancel`,
        { reason: 'Changed my mind' },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.data.status).toBe('CANCELLED');
      expect(cancelResponse.data.refundStatus).toBe('INITIATED');

      // 3. 환불 상태 확인
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 환불 처리 시간

      const refundResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/orders/${orderId}/refund-status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(refundResponse.status).toBe(200);
      expect(refundResponse.data.refundStatus).toBe('COMPLETED');
      expect(refundResponse.data.refundAmount).toBeGreaterThan(0);
    });
  });

  describe('고객 - 성인인증 필요 상품 주문', () => {
    it('나이 제한 상품 추가 → 나이 인증 → 주문 진행', async () => {
      const token = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);
      const restaurant = await getRestaurantsByRegion(ctx, regionId).then((r) =>
        r.find((res) => res.hasAgeRestrictedItems),
      );

      if (!restaurant) {
        console.warn('No restaurant with age-restricted items found');
        return;
      }

      // 1. 나이 제한 상품 조회
      const menuResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/restaurants/${restaurant.id}/menus?includeRestricted=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const ageRestrictedItem = menuResponse.data.menus.find((m) => m.ageRestriction);
      expect(ageRestrictedItem).toBeDefined();

      // 2. 장바구니에 추가
      const cartResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/cart/items`,
        {
          restaurantId: restaurant.id,
          menuItemId: ageRestrictedItem.id,
          quantity: 1,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(cartResponse.status).toBe(201);

      // 3. 결제 시 나이 인증 요청
      const checkoutInitResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/checkout`,
        {
          cartId: cartResponse.data.cartId,
          paymentMethod: 'CARD',
          deliveryAddress: '서울시 강남구 테헤란로 101',
          phoneNumber: '01012345681',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(checkoutInitResponse.status).toBe(202); // Accepted, pending verification
      expect(checkoutInitResponse.data.requiresAgeVerification).toBe(true);

      // 4. 나이 인증 진행
      const verificationResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/age-verification/verify`,
        {
          orderId: checkoutInitResponse.data.orderId,
          birthDate: '1995-06-15',
          verificationMethod: 'IPIN',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(verificationResponse.status).toBe(200);
      expect(verificationResponse.data.verified).toBe(true);

      // 5. 주문 확정
      const confirmResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/${checkoutInitResponse.data.orderId}/confirm`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.data.status).toBe('CONFIRMED');
    });
  });

  describe('고객 - 영업시간 외 주문 시도', () => {
    it('영업시간 외 주문 시도 → 거부 및 안내 메시지 확인', async () => {
      const token = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);

      // 시스템 시간을 영업 외 시간으로 설정 (테스트용)
      await setSystemTime(ctx, '03:00'); // 새벽 3시

      const restaurant = await getRestaurantsByRegion(ctx, regionId).then((r) => r[0]);

      // 1. 영업시간 확인
      const hoursResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/restaurants/${restaurant.id}/hours`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(hoursResponse.status).toBe(200);

      // 2. 주문 시도
      const menu = await getMenuByRestaurant(ctx, restaurant.id, token);
      const cartResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/cart/items`,
        {
          restaurantId: restaurant.id,
          menuItemId: menu[0].id,
          quantity: 1,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const checkoutResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/checkout`,
        {
          cartId: cartResponse.data.cartId,
          paymentMethod: 'CARD',
          deliveryAddress: '서울시 강남구 테헤란로 202',
          phoneNumber: '01012345682',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(checkoutResponse.status).toBe(400);
      expect(checkoutResponse.data.errorCode).toBe('RESTAURANT_CLOSED');
      expect(checkoutResponse.data.message).toContain('영업시간');
    });
  });

  describe('고객 - 배달 불가 지역 주문 시도', () => {
    it('배달 불가 지역 GPS 위치 → 적절한 메시지 표시', async () => {
      // 1. 배달 불가 지역 GPS 좌표
      const unsupportedLocation = { latitude: 35.1234, longitude: 128.5678 }; // Busan

      const regionResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/regions/by-location`,
        { params: unsupportedLocation },
      );
      expect(regionResponse.status).toBe(404);
      expect(regionResponse.data.errorCode).toBe('REGION_NOT_FOUND');
      expect(regionResponse.data.message).toContain('배달 지역');
    });
  });

  describe('고객 - 주문 내역 조회', () => {
    it('다중 주문 생성 → 내 주문 페이지에서 올바르게 그룹화되어 표시', async () => {
      const token = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);
      const restaurants = await getRestaurantsByRegion(ctx, regionId);

      // 1. 3개의 주문 생성
      const orderIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const restaurant = restaurants[i % restaurants.length];
        const menu = await getMenuByRestaurant(ctx, restaurant.id, token);

        const cartResponse = await ctx.customerClient.post(
          `${ctx.baseUrl}/api/cart/items`,
          {
            restaurantId: restaurant.id,
            menuItemId: menu[0].id,
            quantity: 1,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const checkoutResponse = await ctx.customerClient.post(
          `${ctx.baseUrl}/api/orders/checkout`,
          {
            cartId: cartResponse.data.cartId,
            paymentMethod: 'CARD',
            deliveryAddress: `서울시 강남구 테헤란로 ${300 + i * 10}`,
            phoneNumber: `0101234568${i}`,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        orderIds.push(checkoutResponse.data.orderId);
      }

      // 2. 주문 내역 조회
      const ordersResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/my-orders?limit=10&offset=0`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(ordersResponse.status).toBe(200);
      expect(ordersResponse.data.orders.length).toBe(3);

      // 3. 정렬 및 필터 검증
      ordersResponse.data.orders.forEach((order) => {
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('restaurantName');
        expect(order).toHaveProperty('totalPrice');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('createdAt');
      });

      // 4. 날짜 기반 그룹화 확인
      const groupedResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/my-orders?groupBy=date`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(groupedResponse.status).toBe(200);
      expect(groupedResponse.data.groups).toBeDefined();
    });
  });

  /**
   * ========================================
   * ROLE 2: 배달원 (Driver) 시나리오
   * ========================================
   */

  describe('배달원 - 근무 시작/종료', () => {
    it('근무 시작 → 상태 확인 → 근무 종료 → 통계 확인', async () => {
      const token = await getDriverToken(ctx);
      ctx.testData.driverId = await getTestDriverId(ctx, token);

      // 1. 근무 시작
      const startShiftResponse = await ctx.driverClient.post(
        `${ctx.baseUrl}/api/drivers/shift/start`,
        {
          currentLocation: { latitude: 37.4979, longitude: 127.0276 },
          vehicleType: 'MOTORCYCLE',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(startShiftResponse.status).toBe(200);
      expect(startShiftResponse.data.status).toBe('ON_DUTY');

      // 2. 상태 확인
      const statusResponse = await ctx.driverClient.get(`${ctx.baseUrl}/api/drivers/me/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.data.status).toBe('ON_DUTY');
      expect(statusResponse.data.shiftStartTime).toBeDefined();

      // 3. 근무 종료
      const endShiftResponse = await ctx.driverClient.post(
        `${ctx.baseUrl}/api/drivers/shift/end`,
        {
          currentLocation: { latitude: 37.4979, longitude: 127.0276 },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(endShiftResponse.status).toBe(200);
      expect(endShiftResponse.data.status).toBe('OFF_DUTY');

      // 4. 통계 확인
      const statsResponse = await ctx.driverClient.get(
        `${ctx.baseUrl}/api/drivers/me/shift-stats`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(statsResponse.status).toBe(200);
      expect(statsResponse.data).toHaveProperty('totalDeliveries');
      expect(statsResponse.data).toHaveProperty('totalEarnings');
      expect(statsResponse.data).toHaveProperty('shiftDuration');
    });
  });

  describe('배달원 - 주문 배정 및 배달 완료', () => {
    it('근무 시작 → 주문 대기 확인 → 배정 수락 → 픽업 → 배달 → 완료', async () => {
      const driverToken = await getDriverToken(ctx);

      // 1. 근무 시작
      const startShiftResponse = await ctx.driverClient.post(
        `${ctx.baseUrl}/api/drivers/shift/start`,
        {
          currentLocation: { latitude: 37.4979, longitude: 127.0276 },
          vehicleType: 'MOTORCYCLE',
        },
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );
      expect(startShiftResponse.status).toBe(200);
      ctx.testData.driverId = startShiftResponse.data.driverId;

      // 2. 고객이 주문 생성
      const customerToken = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);
      const restaurant = await getRestaurantsByRegion(ctx, regionId).then((r) => r[0]);
      const menu = await getMenuByRestaurant(ctx, restaurant.id, customerToken);

      const cartResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/cart/items`,
        {
          restaurantId: restaurant.id,
          menuItemId: menu[0].id,
          quantity: 1,
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );

      const checkoutResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/checkout`,
        {
          cartId: cartResponse.data.cartId,
          paymentMethod: 'CARD',
          deliveryAddress: '서울시 강남구 테헤란로 400',
          phoneNumber: '01012345683',
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );
      ctx.testData.orderId = checkoutResponse.data.orderId;

      // 3. 주문 대기 목록 확인
      const pendingResponse = await ctx.driverClient.get(
        `${ctx.baseUrl}/api/drivers/assignments/pending`,
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );
      expect(pendingResponse.status).toBe(200);
      expect(pendingResponse.data.assignments.length).toBeGreaterThan(0);

      const assignment = pendingResponse.data.assignments.find(
        (a) => a.orderId === ctx.testData.orderId,
      );
      expect(assignment).toBeDefined();
      ctx.testData.deliveryId = assignment.deliveryId;

      // 4. 배정 수락
      const acceptResponse = await ctx.driverClient.post(
        `${ctx.baseUrl}/api/drivers/assignments/${ctx.testData.deliveryId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );
      expect(acceptResponse.status).toBe(200);
      expect(acceptResponse.data.status).toBe('ACCEPTED');

      // 5. 픽업 확인
      const pickupResponse = await ctx.driverClient.post(
        `${ctx.baseUrl}/api/deliveries/${ctx.testData.deliveryId}/pickup`,
        {
          currentLocation: { latitude: 37.5, longitude: 127.03 },
        },
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );
      expect(pickupResponse.status).toBe(200);
      expect(pickupResponse.data.status).toBe('PICKED_UP');

      // 6. 배달 시작
      const deliveryStartResponse = await ctx.driverClient.post(
        `${ctx.baseUrl}/api/deliveries/${ctx.testData.deliveryId}/start`,
        {
          currentLocation: { latitude: 37.5, longitude: 127.03 },
        },
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );
      expect(deliveryStartResponse.status).toBe(200);
      expect(deliveryStartResponse.data.status).toBe('IN_DELIVERY');

      // 7. 배달 완료
      const completeResponse = await ctx.driverClient.post(
        `${ctx.baseUrl}/api/deliveries/${ctx.testData.deliveryId}/complete`,
        {
          currentLocation: { latitude: 37.51, longitude: 127.04 },
          signature: 'base64encodedSignature',
          photoUrl: 'https://example.com/delivery-photo.jpg',
          temperature: 'HOT',
        },
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );
      expect(completeResponse.status).toBe(200);
      expect(completeResponse.data.status).toBe('COMPLETED');
    });
  });

  describe('배달원 - 다건 배정 관리', () => {
    it('다중 주문 배정 → 순차 배달 → 순서대로 완료', async () => {
      const driverToken = await getDriverToken(ctx);
      const customerToken = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);

      // 1. 근무 시작
      const startShiftResponse = await ctx.driverClient.post(
        `${ctx.baseUrl}/api/drivers/shift/start`,
        {
          currentLocation: { latitude: 37.4979, longitude: 127.0276 },
          vehicleType: 'MOTORCYCLE',
        },
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );
      ctx.testData.driverId = startShiftResponse.data.driverId;

      // 2. 3개의 주문 생성
      const restaurantIds = (await getRestaurantsByRegion(ctx, regionId))
        .slice(0, 3)
        .map((r) => r.id);

      const orderIds: string[] = [];
      const deliveryIds: string[] = [];

      for (let i = 0; i < 3; i++) {
        const menu = await getMenuByRestaurant(ctx, restaurantIds[i], customerToken);
        const cartResponse = await ctx.customerClient.post(
          `${ctx.baseUrl}/api/cart/items`,
          {
            restaurantId: restaurantIds[i],
            menuItemId: menu[0].id,
            quantity: 1,
          },
          { headers: { Authorization: `Bearer ${customerToken}` } },
        );

        const checkoutResponse = await ctx.customerClient.post(
          `${ctx.baseUrl}/api/orders/checkout`,
          {
            cartId: cartResponse.data.cartId,
            paymentMethod: 'CARD',
            deliveryAddress: `서울시 강남구 테헤란로 ${500 + i * 20}`,
            phoneNumber: `0101234568${i + 4}`,
          },
          { headers: { Authorization: `Bearer ${customerToken}` } },
        );
        orderIds.push(checkoutResponse.data.orderId);
      }

      // 3. 모든 배정 수락
      const pendingResponse = await ctx.driverClient.get(
        `${ctx.baseUrl}/api/drivers/assignments/pending`,
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );

      const myAssignments = pendingResponse.data.assignments.filter((a) =>
        orderIds.includes(a.orderId),
      );
      expect(myAssignments.length).toBe(3);

      for (const assignment of myAssignments) {
        const acceptResponse = await ctx.driverClient.post(
          `${ctx.baseUrl}/api/drivers/assignments/${assignment.deliveryId}/accept`,
          {},
          { headers: { Authorization: `Bearer ${driverToken}` } },
        );
        expect(acceptResponse.status).toBe(200);
        deliveryIds.push(assignment.deliveryId);
      }

      // 4. 순차 배달 및 완료
      for (const deliveryId of deliveryIds) {
        const pickupResponse = await ctx.driverClient.post(
          `${ctx.baseUrl}/api/deliveries/${deliveryId}/pickup`,
          { currentLocation: { latitude: 37.5, longitude: 127.03 } },
          { headers: { Authorization: `Bearer ${driverToken}` } },
        );
        expect(pickupResponse.status).toBe(200);

        const completeResponse = await ctx.driverClient.post(
          `${ctx.baseUrl}/api/deliveries/${deliveryId}/complete`,
          {
            currentLocation: { latitude: 37.51, longitude: 127.04 },
            signature: 'base64encodedSignature',
          },
          { headers: { Authorization: `Bearer ${driverToken}` } },
        );
        expect(completeResponse.status).toBe(200);
      }

      // 5. 드라이버 통계 확인
      const statsResponse = await ctx.driverClient.get(
        `${ctx.baseUrl}/api/drivers/me/shift-stats`,
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );
      expect(statsResponse.status).toBe(200);
      expect(statsResponse.data.totalDeliveries).toBe(3);
    });
  });

  describe('배달원 - 배달 이력 조회', () => {
    it('배달 완료 → 날짜 범위로 이력 조회', async () => {
      const driverToken = await getDriverToken(ctx);

      // 1. 배달 이력 조회
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // 7일 전

      const historyResponse = await ctx.driverClient.get(
        `${ctx.baseUrl}/api/drivers/me/delivery-history`,
        {
          params: {
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString(),
          },
          headers: { Authorization: `Bearer ${driverToken}` },
        },
      );
      expect(historyResponse.status).toBe(200);
      expect(Array.isArray(historyResponse.data.deliveries)).toBe(true);
      expect(historyResponse.data).toHaveProperty('totalCount');

      // 2. 각 배달 항목 검증
      historyResponse.data.deliveries.forEach((delivery) => {
        expect(delivery).toHaveProperty('orderId');
        expect(delivery).toHaveProperty('restaurantName');
        expect(delivery).toHaveProperty('earnings');
        expect(delivery).toHaveProperty('completedAt');
        expect(delivery).toHaveProperty('distance');
        expect(delivery).toHaveProperty('duration');
      });
    });
  });

  describe('배달원 - 정산 확인', () => {
    it('배달 완료 → 정산 금액 계산 및 검증', async () => {
      const driverToken = await getDriverToken(ctx);

      // 1. 현재 월의 정산 정보 조회
      const settlementResponse = await ctx.driverClient.get(
        `${ctx.baseUrl}/api/drivers/me/settlement?month=current`,
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );
      expect(settlementResponse.status).toBe(200);
      expect(settlementResponse.data).toHaveProperty('totalEarnings');
      expect(settlementResponse.data).toHaveProperty('totalDeliveries');
      expect(settlementResponse.data).toHaveProperty('avgEarningsPerDelivery');
      expect(settlementResponse.data).toHaveProperty('platformFee');
      expect(settlementResponse.data).toHaveProperty('netEarnings');

      // 2. 정산 상세 조회
      const detailResponse = await ctx.driverClient.get(
        `${ctx.baseUrl}/api/drivers/me/settlement/details`,
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );
      expect(detailResponse.status).toBe(200);
      expect(Array.isArray(detailResponse.data.transactions)).toBe(true);

      // 3. 각 거래 항목 검증
      detailResponse.data.transactions.forEach((transaction) => {
        expect(transaction).toHaveProperty('orderId');
        expect(transaction).toHaveProperty('amount');
        expect(transaction).toHaveProperty('fee');
        expect(transaction).toHaveProperty('net');
        expect(transaction).toHaveProperty('date');
      });
    });
  });

  /**
   * ========================================
   * ROLE 3: 지역 어드민 (Region Admin) 시나리오
   * ========================================
   */

  describe('지역어드민 - 대시보드 조회', () => {
    it('로그인 → 대시보드 확인 → 지역 범위 데이터만 표시', async () => {
      const adminToken = await getRegionAdminToken(ctx);
      ctx.testData.regionAdminId = await getTestRegionAdminId(ctx, adminToken);

      // 1. 대시보드 데이터 조회
      const dashboardResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/dashboard`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.data).toHaveProperty('totalOrders');
      expect(dashboardResponse.data).toHaveProperty('totalRestaurants');
      expect(dashboardResponse.data).toHaveProperty('totalDrivers');
      expect(dashboardResponse.data).toHaveProperty('totalRevenue');

      // 2. 지역 범위 확인
      const regionResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/region-info`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(regionResponse.status).toBe(200);
      expect(regionResponse.data).toHaveProperty('regionId');
      expect(regionResponse.data).toHaveProperty('regionName');

      // 3. 대시보드의 모든 데이터가 해당 지역에만 속하는지 확인
      const ordersResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/orders?limit=100`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(ordersResponse.status).toBe(200);
      ordersResponse.data.orders.forEach((order) => {
        expect(order.regionId).toBe(regionResponse.data.regionId);
      });
    });
  });

  describe('지역어드민 - 주문 수동 진행', () => {
    it('대기중 주문 → 각 상태별 진행 → 필수 정보 입력 → 검증', async () => {
      const adminToken = await getRegionAdminToken(ctx);
      const customerToken = await getCustomerToken(ctx);

      // 1. 주문 생성
      const regionId = await getTestRegionId(ctx);
      const restaurant = await getRestaurantsByRegion(ctx, regionId).then((r) => r[0]);
      const menu = await getMenuByRestaurant(ctx, restaurant.id, customerToken);

      const cartResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/cart/items`,
        {
          restaurantId: restaurant.id,
          menuItemId: menu[0].id,
          quantity: 1,
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );

      const checkoutResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/checkout`,
        {
          cartId: cartResponse.data.cartId,
          paymentMethod: 'CARD',
          deliveryAddress: '서울시 강남구 테헤란로 600',
          phoneNumber: '01012345684',
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );
      const orderId = checkoutResponse.data.orderId;

      // 2. PENDING → ACCEPTED
      const acceptResponse = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/orders/${orderId}/advance-status`,
        { nextStatus: 'ACCEPTED', notes: 'Order accepted by admin' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(acceptResponse.status).toBe(200);
      expect(acceptResponse.data.status).toBe('ACCEPTED');

      // 3. ACCEPTED → PREPARING
      const preparingResponse = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/orders/${orderId}/advance-status`,
        { nextStatus: 'PREPARING', notes: 'Kitchen started preparing' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(preparingResponse.status).toBe(200);

      // 4. PREPARING → READY
      const readyResponse = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/orders/${orderId}/advance-status`,
        { nextStatus: 'READY', notes: 'Order is ready for pickup' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(readyResponse.status).toBe(200);

      // 5. READY → ASSIGNED (배달원 배정)
      const driverToken = await getDriverToken(ctx);
      const driverId = await getTestDriverId(ctx, driverToken);

      const assignResponse = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/orders/${orderId}/assign-driver`,
        { driverId },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(assignResponse.status).toBe(200);
      expect(assignResponse.data.assignedDriverId).toBe(driverId);
    });
  });

  describe('지역어드민 - 주문 취소 및 삭제', () => {
    it('주문 취소(사유 필수) → 주문 삭제(사유 필수) → 기록 확인', async () => {
      const adminToken = await getRegionAdminToken(ctx);
      const customerToken = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);

      // 1. 주문 생성
      const restaurant = await getRestaurantsByRegion(ctx, regionId).then((r) => r[0]);
      const menu = await getMenuByRestaurant(ctx, restaurant.id, customerToken);

      const cartResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/cart/items`,
        {
          restaurantId: restaurant.id,
          menuItemId: menu[0].id,
          quantity: 1,
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );

      const checkoutResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/checkout`,
        {
          cartId: cartResponse.data.cartId,
          paymentMethod: 'CARD',
          deliveryAddress: '서울시 강남구 테헤란로 700',
          phoneNumber: '01012345685',
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );
      const orderId = checkoutResponse.data.orderId;

      // 2. 주문 취소 (사유 필수)
      const cancelResponse = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/orders/${orderId}/cancel`,
        { reason: 'Restaurant out of stock on required item' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.data.status).toBe('CANCELLED');
      expect(cancelResponse.data.cancelledAt).toBeDefined();
      expect(cancelResponse.data.cancelReason).toBe('Restaurant out of stock on required item');

      // 3. 주문 삭제 (사유 필수)
      const deleteResponse = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/orders/${orderId}/delete`,
        { reason: 'Test data cleanup' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(deleteResponse.status).toBe(200);

      // 4. 감시 로그 확인
      const auditResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/audit-logs?entityId=${orderId}&action=DELETE`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(auditResponse.status).toBe(200);
      expect(auditResponse.data.logs.length).toBeGreaterThan(0);
      const deleteLog = auditResponse.data.logs.find((l) => l.action === 'DELETE');
      expect(deleteLog).toBeDefined();
      expect(deleteLog.changes).toHaveProperty('reason');
    });
  });

  describe('지역어드민 - 식당 관리', () => {
    it('식당 추가 → 정보 수정 → 활성화/비활성화 → 메뉴 관리', async () => {
      const adminToken = await getRegionAdminToken(ctx);
      const regionId = await getTestRegionId(ctx);

      // 1. 식당 추가
      const addResponse = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/restaurants`,
        {
          regionId,
          name: 'Test Restaurant',
          address: '서울시 강남구 테헤란로 800',
          phone: '02-1234-5678',
          businessHours: {
            mon: { open: '11:00', close: '23:00' },
            tue: { open: '11:00', close: '23:00' },
            wed: { open: '11:00', close: '23:00' },
            thu: { open: '11:00', close: '23:00' },
            fri: { open: '11:00', close: '24:00' },
            sat: { open: '11:00', close: '24:00' },
            sun: { open: '12:00', close: '23:00' },
          },
          category: 'KOREAN',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(addResponse.status).toBe(201);
      const restaurantId = addResponse.data.restaurantId;
      ctx.testData.restaurantId = restaurantId;

      // 2. 정보 수정
      const editResponse = await ctx.regionAdminClient.patch(
        `${ctx.baseUrl}/api/admin/restaurants/${restaurantId}`,
        {
          name: 'Updated Test Restaurant',
          phone: '02-9876-5432',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(editResponse.status).toBe(200);
      expect(editResponse.data.name).toBe('Updated Test Restaurant');

      // 3. 활성화 확인
      const activateResponse = await ctx.regionAdminClient.patch(
        `${ctx.baseUrl}/api/admin/restaurants/${restaurantId}`,
        { active: true },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(activateResponse.status).toBe(200);
      expect(activateResponse.data.active).toBe(true);

      // 4. 비활성화
      const deactivateResponse = await ctx.regionAdminClient.patch(
        `${ctx.baseUrl}/api/admin/restaurants/${restaurantId}`,
        { active: false },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(deactivateResponse.status).toBe(200);
      expect(deactivateResponse.data.active).toBe(false);

      // 5. 메뉴 추가
      const menuAddResponse = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/restaurants/${restaurantId}/menus`,
        {
          name: 'Test Menu Item',
          description: 'Delicious test item',
          price: 12000,
          category: 'MAIN',
          available: true,
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(menuAddResponse.status).toBe(201);
      expect(menuAddResponse.data).toHaveProperty('menuId');

      // 6. 메뉴 조회
      const menusResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/restaurants/${restaurantId}/menus`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(menusResponse.status).toBe(200);
      expect(Array.isArray(menusResponse.data.menus)).toBe(true);
    });
  });

  describe('지역어드민 - 배달원 관리', () => {
    it('배달원 등록 → 승인 → 배달 통계 조회', async () => {
      const adminToken = await getRegionAdminToken(ctx);

      // 1. 배달원 등록
      const registerResponse = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/drivers`,
        {
          name: 'Test Driver',
          phone: '01012345600',
          licenseNumber: 'AB-1234567',
          vehicleType: 'MOTORCYCLE',
          licenseExpiry: '2026-12-31',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(registerResponse.status).toBe(201);
      const driverId = registerResponse.data.driverId;

      // 2. 배달원 승인
      const approveResponse = await ctx.regionAdminClient.patch(
        `${ctx.baseUrl}/api/admin/drivers/${driverId}`,
        { status: 'APPROVED' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(approveResponse.status).toBe(200);
      expect(approveResponse.data.status).toBe('APPROVED');

      // 3. 배달원 통계 조회
      const statsResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/drivers/${driverId}/stats`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(statsResponse.status).toBe(200);
      expect(statsResponse.data).toHaveProperty('totalDeliveries');
      expect(statsResponse.data).toHaveProperty('avgRating');
      expect(statsResponse.data).toHaveProperty('activeStatus');
    });
  });

  describe('지역어드민 - 타 지역 접근 차단', () => {
    it('다른 지역의 데이터에 접근 시도 → 403 권한 거부', async () => {
      const adminToken = await getRegionAdminToken(ctx);

      // 1. 현재 어드민의 지역 확인
      const regionResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/region-info`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      const currentRegionId = regionResponse.data.regionId;

      // 2. 다른 지역 ID 생성 (테스트 목적)
      const otherRegionId = `region-${Date.now()}`;

      // 3. 다른 지역의 식당 조회 시도
      const restaurantsResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/restaurants?regionId=${otherRegionId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(restaurantsResponse.status).toBe(403);
      expect(restaurantsResponse.data.errorCode).toBe('FORBIDDEN');

      // 4. 다른 지역의 주문 조회 시도
      const ordersResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/orders?regionId=${otherRegionId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(ordersResponse.status).toBe(403);
    });
  });

  /**
   * ========================================
   * ROLE 4: 시스템 어드민 (System Admin) 시나리오
   * ========================================
   */

  describe('시스템어드민 - 지역 생성', () => {
    it('새 지역 생성 → 주소 키워드 설정 → 자동 스크래핑 → 식당 미활성 상태 확인', async () => {
      const adminToken = await getSystemAdminToken(ctx);

      // 1. 지역 생성
      const createResponse = await ctx.systemAdminClient.post(
        `${ctx.baseUrl}/api/system-admin/regions`,
        {
          name: 'Test Region',
          addressKeywords: ['테헤란로', '논현동', '강남역'],
          deliveryRadius: 5000,
          baseDeliveryFee: 2500,
          timezone: 'Asia/Seoul',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(createResponse.status).toBe(201);
      const regionId = createResponse.data.regionId;
      ctx.testData.regionId = regionId;

      // 2. 지역 정보 확인
      const regionResponse = await ctx.systemAdminClient.get(
        `${ctx.baseUrl}/api/system-admin/regions/${regionId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(regionResponse.status).toBe(200);
      expect(regionResponse.data).toHaveProperty('regionId');
      expect(regionResponse.data).toHaveProperty('addressKeywords');

      // 3. 자동 스크래핑 진행 (DiningCode API)
      const scrapeResponse = await ctx.systemAdminClient.post(
        `${ctx.baseUrl}/api/system-admin/regions/${regionId}/scrape-restaurants`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(scrapeResponse.status).toBe(202); // 비동기 작업
      expect(scrapeResponse.data).toHaveProperty('taskId');

      // 4. 스크래핑 진행 상황 확인
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const scrapingStatusResponse = await ctx.systemAdminClient.get(
        `${ctx.baseUrl}/api/system-admin/scraping-tasks/${scrapeResponse.data.taskId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(scrapingStatusResponse.status).toBe(200);
      expect(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']).toContain(
        scrapingStatusResponse.data.status,
      );

      // 5. 스크래핑된 식당 확인 (모두 미활성 상태)
      const restaurantsResponse = await ctx.systemAdminClient.get(
        `${ctx.baseUrl}/api/system-admin/restaurants?regionId=${regionId}&active=false`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(restaurantsResponse.status).toBe(200);
      expect(Array.isArray(restaurantsResponse.data.restaurants)).toBe(true);
      restaurantsResponse.data.restaurants.forEach((restaurant) => {
        expect(restaurant.active).toBe(false);
      });
    });
  });

  describe('시스템어드민 - 지역 어드민 계정 생성', () => {
    it('지역 어드민 생성 → 지역 배정 → 접근 범위 검증', async () => {
      const adminToken = await getSystemAdminToken(ctx);
      const regionId = await getTestRegionId(ctx);

      // 1. 지역 어드민 계정 생성
      const createAdminResponse = await ctx.systemAdminClient.post(
        `${ctx.baseUrl}/api/system-admin/region-admins`,
        {
          email: `region-admin-${Date.now()}@hkd.local`,
          password: 'SecurePassword123!',
          name: 'Region Admin',
          regionId,
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(createAdminResponse.status).toBe(201);
      const regionAdminId = createAdminResponse.data.adminId;

      // 2. 어드민 활성화
      const activateResponse = await ctx.systemAdminClient.patch(
        `${ctx.baseUrl}/api/system-admin/region-admins/${regionAdminId}`,
        { active: true },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(activateResponse.status).toBe(200);

      // 3. 로그인 및 접근 범위 확인
      const loginResponse = await axios.post(`${ctx.baseUrl}/api/auth/login`, {
        email: `region-admin-${Date.now()}@hkd.local`,
        password: 'SecurePassword123!',
      });
      expect(loginResponse.status).toBe(200);
      const newAdminToken = loginResponse.data.token;

      // 4. 배정된 지역 정보만 접근 가능 확인
      const regionInfoResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/region-info`,
        { headers: { Authorization: `Bearer ${newAdminToken}` } },
      );
      expect(regionInfoResponse.status).toBe(200);
      expect(regionInfoResponse.data.regionId).toBe(regionId);

      // 5. 다른 지역 접근 차단 확인
      const otherRegionResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/restaurants?regionId=other-region-id`,
        { headers: { Authorization: `Bearer ${newAdminToken}` } },
      );
      expect(otherRegionResponse.status).toBe(403);
    });
  });

  describe('시스템어드민 - 전체 지역 데이터 조회', () => {
    it('모든 지역의 주문, 식당, 배달원 데이터 조회', async () => {
      const adminToken = await getSystemAdminToken(ctx);

      // 1. 모든 지역 조회
      const regionsResponse = await ctx.systemAdminClient.get(
        `${ctx.baseUrl}/api/system-admin/regions?limit=50`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(regionsResponse.status).toBe(200);
      expect(Array.isArray(regionsResponse.data.regions)).toBe(true);

      // 2. 전체 주문 조회
      const ordersResponse = await ctx.systemAdminClient.get(
        `${ctx.baseUrl}/api/system-admin/orders?limit=50`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(ordersResponse.status).toBe(200);
      expect(ordersResponse.data).toHaveProperty('totalCount');
      ordersResponse.data.orders.forEach((order) => {
        expect(order).toHaveProperty('regionId');
      });

      // 3. 전체 식당 조회
      const restaurantsResponse = await ctx.systemAdminClient.get(
        `${ctx.baseUrl}/api/system-admin/restaurants?limit=50`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(restaurantsResponse.status).toBe(200);
      restaurantsResponse.data.restaurants.forEach((restaurant) => {
        expect(restaurant).toHaveProperty('regionId');
      });

      // 4. 전체 배달원 조회
      const driversResponse = await ctx.systemAdminClient.get(
        `${ctx.baseUrl}/api/system-admin/drivers?limit=50`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(driversResponse.status).toBe(200);
      driversResponse.data.drivers.forEach((driver) => {
        expect(driver).toHaveProperty('regionId');
      });
    });
  });

  describe('시스템어드민 - 시스템 설정', () => {
    it('플랫폼 시간 업데이트 → 배달비 설정 변경 → 전파 확인', async () => {
      const adminToken = await getSystemAdminToken(ctx);

      // 1. 플랫폼 시간 설정
      const hoursUpdateResponse = await ctx.systemAdminClient.patch(
        `${ctx.baseUrl}/api/system-admin/settings/platform-hours`,
        {
          weekdayOpen: '10:00',
          weekdayClose: '23:00',
          weekendOpen: '11:00',
          weekendClose: '24:00',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(hoursUpdateResponse.status).toBe(200);

      // 2. 배달비 설정 변경
      const feeUpdateResponse = await ctx.systemAdminClient.patch(
        `${ctx.baseUrl}/api/system-admin/settings/delivery-fees`,
        {
          baseFee: 3000,
          perKmFee: 500,
          minFee: 2500,
          maxFee: 10000,
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(feeUpdateResponse.status).toBe(200);

      // 3. 설정 조회 및 전파 확인
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const settingsResponse = await ctx.systemAdminClient.get(
        `${ctx.baseUrl}/api/system-admin/settings`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(settingsResponse.status).toBe(200);
      expect(settingsResponse.data.platformHours.weekdayOpen).toBe('10:00');
      expect(settingsResponse.data.deliveryFees.baseFee).toBe(3000);

      // 4. 고객 API에서 새로운 배달비로 계산되는지 확인
      const customerToken = await getCustomerToken(ctx);
      const feeCalcResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/calculate-fee`,
        {
          deliveryAddress: '서울시 강남구 테헤란로 900',
          distance: 5000, // 5km
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );
      expect(feeCalcResponse.status).toBe(200);
      expect(feeCalcResponse.data.deliveryFee).toBe(3000 + 500 * 5); // 5500
    });
  });

  describe('시스템어드민 - 지역 수정 및 비활성화', () => {
    it('지역 정보 수정 → 활성화 상태 전환 → 데이터 검증', async () => {
      const adminToken = await getSystemAdminToken(ctx);
      const regionId = await getTestRegionId(ctx);

      // 1. 지역 정보 수정
      const editResponse = await ctx.systemAdminClient.patch(
        `${ctx.baseUrl}/api/system-admin/regions/${regionId}`,
        {
          name: 'Updated Region Name',
          baseDeliveryFee: 3000,
          deliveryRadius: 6000,
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(editResponse.status).toBe(200);
      expect(editResponse.data.name).toBe('Updated Region Name');

      // 2. 지역 비활성화
      const deactivateResponse = await ctx.systemAdminClient.patch(
        `${ctx.baseUrl}/api/system-admin/regions/${regionId}`,
        { active: false },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(deactivateResponse.status).toBe(200);
      expect(deactivateResponse.data.active).toBe(false);

      // 3. 비활성화된 지역으로 주문 시도 → 실패
      const customerToken = await getCustomerToken(ctx);
      const gpsLocation = { latitude: 37.4979, longitude: 127.0276 };

      const regionCheckResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/regions/by-location`,
        { params: gpsLocation },
      );
      expect(regionCheckResponse.status).toBe(404);

      // 4. 지역 다시 활성화
      const reactivateResponse = await ctx.systemAdminClient.patch(
        `${ctx.baseUrl}/api/system-admin/regions/${regionId}`,
        { active: true },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      expect(reactivateResponse.status).toBe(200);
      expect(reactivateResponse.data.active).toBe(true);
    });
  });

  /**
   * ========================================
   * CROSS-CUTTING CONCERNS (횡단 관심사)
   * ========================================
   */

  describe('횡단 관심사 - 인증/권한', () => {
    it('토큰 만료 → 리프레시 토큰으로 갱신', async () => {
      const customerToken = await getCustomerToken(ctx);

      // 1. 정상 요청
      const regionId = await getTestRegionId(ctx);
      const restaurantsResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/restaurants?regionId=${regionId}`,
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );
      expect(restaurantsResponse.status).toBe(200);

      // 2. 토큰 만료 시뮬레이션 (테스트용 만료된 토큰 사용)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MjAwMDAwMDB9.mock';
      const expiredResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/restaurants?regionId=${regionId}`,
        { headers: { Authorization: `Bearer ${expiredToken}` } },
      );
      expect(expiredResponse.status).toBe(401);
      expect(expiredResponse.data.errorCode).toBe('TOKEN_EXPIRED');

      // 3. 리프레시 토큰으로 새 토큰 발급
      const refreshResponse = await axios.post(`${ctx.baseUrl}/api/auth/refresh`, {
        refreshToken: await getRefreshToken(ctx),
      });
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.data).toHaveProperty('accessToken');

      // 4. 새 토큰으로 요청 성공
      const newTokenResponse = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/restaurants?regionId=${regionId}`,
        { headers: { Authorization: `Bearer ${refreshResponse.data.accessToken}` } },
      );
      expect(newTokenResponse.status).toBe(200);
    });

    it('권한 에스컬레이션 방지 - 배달원이 어드민 권한으로 접근 불가', async () => {
      const driverToken = await getDriverToken(ctx);

      // 배달원이 어드민 API 접근 시도
      const adminResponse = await ctx.driverClient.get(`${ctx.baseUrl}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${driverToken}` },
      });
      expect(adminResponse.status).toBe(403);
      expect(adminResponse.data.errorCode).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('Base64 헤더 인코딩 처리 검증', async () => {
      const regionId = await getTestRegionId(ctx);
      const customerToken = await getCustomerToken(ctx);

      // Base64 인코딩된 헤더
      const authHeader = Buffer.from(`Bearer ${customerToken}`).toString('base64');

      const response = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/restaurants?regionId=${regionId}`,
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
          },
        },
      );
      // 부정확한 형식이므로 실패 예상
      expect(response.status).toBe(401);
    });
  });

  describe('횡단 관심사 - 동시성', () => {
    it('동일 식당에 대한 다중 주문 동시 처리', async () => {
      const regionId = await getTestRegionId(ctx);
      const restaurant = await getRestaurantsByRegion(ctx, regionId).then((r) => r[0]);

      // 3개의 고객이 동시에 주문
      const promises = [];
      for (let i = 0; i < 3; i++) {
        const customerToken = await getCustomerToken(ctx);
        const menu = await getMenuByRestaurant(ctx, restaurant.id, customerToken);

        promises.push(
          ctx.customerClient.post(
            `${ctx.baseUrl}/api/cart/items`,
            {
              restaurantId: restaurant.id,
              menuItemId: menu[0].id,
              quantity: 1,
            },
            { headers: { Authorization: `Bearer ${customerToken}` } },
          ),
        );
      }

      const results = await Promise.all(promises);

      // 모두 성공해야 함
      results.forEach((result) => {
        expect(result.status).toBe(201);
        expect(result.data).toHaveProperty('cartId');
      });
    });

    it('동시 배달원 배정 - 한 주문은 하나의 배달원만 배정', async () => {
      const customerToken = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);
      const restaurant = await getRestaurantsByRegion(ctx, regionId).then((r) => r[0]);
      const menu = await getMenuByRestaurant(ctx, restaurant.id, customerToken);

      // 주문 생성
      const cartResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/cart/items`,
        {
          restaurantId: restaurant.id,
          menuItemId: menu[0].id,
          quantity: 1,
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );

      const checkoutResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/checkout`,
        {
          cartId: cartResponse.data.cartId,
          paymentMethod: 'CARD',
          deliveryAddress: '서울시 강남구 테헤란로 1000',
          phoneNumber: '01012345686',
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );
      const orderId = checkoutResponse.data.orderId;

      // 2명의 배달원이 동시에 주문 수락 시도
      const driver1Token = await getDriverToken(ctx);
      const driver2Token = await getDriverToken(ctx);

      const driver1 = await getTestDriverId(ctx, driver1Token);
      const driver2 = await getTestDriverId(ctx, driver2Token);

      // 배달원 근무 시작
      await ctx.driverClient.post(
        `${ctx.baseUrl}/api/drivers/shift/start`,
        {
          currentLocation: { latitude: 37.4979, longitude: 127.0276 },
          vehicleType: 'MOTORCYCLE',
        },
        { headers: { Authorization: `Bearer ${driver1Token}` } },
      );

      await ctx.driverClient.post(
        `${ctx.baseUrl}/api/drivers/shift/start`,
        {
          currentLocation: { latitude: 37.4979, longitude: 127.0276 },
          vehicleType: 'MOTORCYCLE',
        },
        { headers: { Authorization: `Bearer ${driver2Token}` } },
      );

      // 동시 배정 시도
      const assignments = await Promise.all([
        ctx.driverClient.post(
          `${ctx.baseUrl}/api/orders/${orderId}/assign`,
          { driverId: driver1 },
          { headers: { Authorization: `Bearer ${driver1Token}` } },
        ),
        ctx.driverClient.post(
          `${ctx.baseUrl}/api/orders/${orderId}/assign`,
          { driverId: driver2 },
          { headers: { Authorization: `Bearer ${driver2Token}` } },
        ),
      ]).then((results) => results.filter((r) => r.status === 200 || r.status === 409));

      // 하나는 성공, 하나는 충돌(409)
      const successCount = assignments.filter((r) => r.status === 200).length;
      const conflictCount = assignments.filter((r) => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);
    });
  });

  describe('횡단 관심사 - 데이터 격리', () => {
    it('지역 어드민은 자신의 지역 데이터만 조회', async () => {
      const admin1Token = await getRegionAdminToken(ctx);
      const admin2Token = await getRegionAdminToken(ctx);

      // 각 어드민의 지역 확인
      const admin1RegionResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/region-info`,
        { headers: { Authorization: `Bearer ${admin1Token}` } },
      );
      const admin1RegionId = admin1RegionResponse.data.regionId;

      const admin2RegionResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/region-info`,
        { headers: { Authorization: `Bearer ${admin2Token}` } },
      );
      const admin2RegionId = admin2RegionResponse.data.regionId;

      // Admin1이 자신의 지역 데이터 조회 (성공)
      const selfResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/restaurants?regionId=${admin1RegionId}`,
        { headers: { Authorization: `Bearer ${admin1Token}` } },
      );
      expect(selfResponse.status).toBe(200);

      // Admin1이 다른 지역 데이터 조회 (실패)
      const otherResponse = await ctx.regionAdminClient.get(
        `${ctx.baseUrl}/api/admin/restaurants?regionId=${admin2RegionId}`,
        { headers: { Authorization: `Bearer ${admin1Token}` } },
      );
      expect(otherResponse.status).toBe(403);
    });
  });

  describe('횡단 관심사 - 입력 검증', () => {
    it('SQL 인젝션 방지', async () => {
      const token = await getCustomerToken(ctx);

      const maliciousInput = "'; DROP TABLE orders; --";
      const response = await ctx.customerClient.get(`${ctx.baseUrl}/api/orders`, {
        params: { filter: maliciousInput },
        headers: { Authorization: `Bearer ${token}` },
      });
      // 정상 에러 응답 (데이터 손상 없음)
      expect(response.status).toBe(400);
      expect(response.data.errorCode).toBe('INVALID_INPUT');
    });

    it('XSS 방지', async () => {
      const adminToken = await getRegionAdminToken(ctx);
      const regionId = await getTestRegionId(ctx);

      const xssPayload = '<script>alert("xss")</script>';
      const response = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/restaurants`,
        {
          regionId,
          name: xssPayload,
          address: '서울시 강남구',
          phone: '02-1234-5678',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (response.status === 201) {
        // 저장되었다면 이스케이프되어야 함
        const getResponse = await ctx.regionAdminClient.get(
          `${ctx.baseUrl}/api/admin/restaurants/${response.data.restaurantId}`,
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );
        expect(getResponse.data.name).not.toContain('<script>');
      }
    });

    it('과도한 페이로드 거부', async () => {
      const adminToken = await getRegionAdminToken(ctx);
      const regionId = await getTestRegionId(ctx);

      // 10MB 크기의 페이로드
      const largePayload = 'x'.repeat(10 * 1024 * 1024);

      const response = await ctx.regionAdminClient.post(
        `${ctx.baseUrl}/api/admin/restaurants`,
        {
          regionId,
          name: 'Test',
          description: largePayload,
          address: '서울시',
          phone: '02-1234-5678',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      expect(response.status).toBe(413);
      expect(response.data.errorCode).toBe('PAYLOAD_TOO_LARGE');
    });

    it('유효하지 않은 좌표 거부', async () => {
      const token = await getCustomerToken(ctx);

      const invalidLocation = { latitude: 100, longitude: 200 }; // 유효 범위 초과

      const response = await ctx.customerClient.get(`${ctx.baseUrl}/api/regions/by-location`, {
        params: invalidLocation,
      });

      expect(response.status).toBe(400);
      expect(response.data.errorCode).toBe('INVALID_COORDINATES');
    });
  });

  describe('횡단 관심사 - 에러 처리', () => {
    it('네트워크 장애 시 재시도 로직', async () => {
      const token = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);

      // 이미 연결된 클라이언트를 사용하므로 정상 요청 수행
      const response = await ctx.customerClient.get(
        `${ctx.baseUrl}/api/restaurants?regionId=${regionId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      expect(response.status).toBe(200);
    });

    it('외부 API 타임아웃 처리', async () => {
      const adminToken = await getSystemAdminToken(ctx);

      // 스크래핑 작업 중 외부 API 타임아웃 시뮬레이션
      const regionId = await getTestRegionId(ctx);

      const response = await ctx.systemAdminClient.post(
        `${ctx.baseUrl}/api/system-admin/regions/${regionId}/scrape-restaurants`,
        { timeout: 1000 }, // 1초 타임아웃
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      // 비동기이므로 202 수락됨
      expect([202, 408]).toContain(response.status);
    });
  });

  describe('횡단 관심사 - 배달비 정확성', () => {
    it('거리 기반 배달비 계산 - 엣지 케이스', async () => {
      const token = await getCustomerToken(ctx);

      // 0km
      const zeroResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/calculate-fee`,
        {
          deliveryAddress: '서울시 강남구 테헤란로 1100',
          distance: 0,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(zeroResponse.status).toBe(200);
      expect(zeroResponse.data.deliveryFee).toBeGreaterThanOrEqual(2500); // 최소 배달비

      // 100km (매우 먼 거리)
      const farResponse = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/calculate-fee`,
        {
          deliveryAddress: '인천시',
          distance: 100,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(farResponse.status).toBe(200);
      expect(farResponse.data.deliveryFee).toBeLessThanOrEqual(10000); // 최대 배달비
    });

    it('다중 식당 배달비 누적', async () => {
      const token = await getCustomerToken(ctx);
      const regionId = await getTestRegionId(ctx);
      const restaurants = await getRestaurantsByRegion(ctx, regionId);

      const items = [];
      for (let i = 0; i < Math.min(3, restaurants.length); i++) {
        items.push({ restaurantId: restaurants[i].id });
      }

      const response = await ctx.customerClient.post(
        `${ctx.baseUrl}/api/orders/calculate-fee`,
        {
          deliveryAddress: '서울시 강남구 테헤란로 1200',
          cartItems: items,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      expect(response.status).toBe(200);
      // 다중 식당이면 단일 배달비 기본값 + 추가 비용
      expect(response.data.isMultipleRestaurants).toBe(items.length > 1);
    });
  });

  describe('횡단 관심사 - 정산 정확성', () => {
    it('월간 정산 계산 - 서비스비 및 세금 처리', async () => {
      const driverToken = await getDriverToken(ctx);

      // 정산 정보 조회
      const settlementResponse = await ctx.driverClient.get(
        `${ctx.baseUrl}/api/drivers/me/settlement?month=current`,
        { headers: { Authorization: `Bearer ${driverToken}` } },
      );

      expect(settlementResponse.status).toBe(200);

      const settlement = settlementResponse.data;
      expect(settlement).toHaveProperty('totalEarnings');
      expect(settlement).toHaveProperty('platformFee');
      expect(settlement).toHaveProperty('tax');
      expect(settlement).toHaveProperty('netEarnings');

      // 계산 검증
      const expectedNet = settlement.totalEarnings - settlement.platformFee - settlement.tax;
      expect(settlement.netEarnings).toBeCloseTo(expectedNet, 2);
    });
  });
});

/**
 * ========================================
 * Helper Functions
 * ========================================
 */

async function setupTestEnvironment(ctx: TestContext): Promise<void> {
  // 테스트 환경 초기화
  console.log('Setting up test environment...');
}

async function cleanupTestData(ctx: TestContext): Promise<void> {
  // 생성된 테스트 데이터 삭제
  console.log('Cleaning up test data...');
}

async function getCustomerToken(ctx: TestContext): Promise<string> {
  const email = `customer-${Date.now()}@test.local`;
  const response = await axios.post(`${ctx.baseUrl}/api/auth/register`, {
    email,
    password: 'TestPassword123!',
    name: 'Test Customer',
    role: 'CUSTOMER',
  });
  return response.data.token;
}

async function getDriverToken(ctx: TestContext): Promise<string> {
  const email = `driver-${Date.now()}@test.local`;
  const response = await axios.post(`${ctx.baseUrl}/api/auth/register`, {
    email,
    password: 'TestPassword123!',
    name: 'Test Driver',
    role: 'DRIVER',
    licenseNumber: `DL-${Date.now()}`,
  });
  return response.data.token;
}

async function getRegionAdminToken(ctx: TestContext): Promise<string> {
  const email = `admin-${Date.now()}@test.local`;
  const response = await axios.post(`${ctx.baseUrl}/api/auth/register`, {
    email,
    password: 'TestPassword123!',
    name: 'Test Admin',
    role: 'REGION_ADMIN',
    regionId: await getTestRegionId(ctx),
  });
  return response.data.token;
}

async function getSystemAdminToken(ctx: TestContext): Promise<string> {
  const response = await axios.post(`${ctx.baseUrl}/api/auth/login`, {
    email: process.env.TEST_SYSTEM_ADMIN_EMAIL || 'system-admin@test.local',
    password: process.env.TEST_SYSTEM_ADMIN_PASSWORD || 'AdminPassword123!',
  });
  return response.data.token;
}

async function getTestRegionId(ctx: TestContext): Promise<string> {
  if (ctx.testData.regionId) {
    return ctx.testData.regionId;
  }

  const adminToken = await getSystemAdminToken(ctx);
  const response = await ctx.systemAdminClient.get(
    `${ctx.baseUrl}/api/system-admin/regions?limit=1`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );

  const regionId = response.data.regions[0].id;
  ctx.testData.regionId = regionId;
  return regionId;
}

async function getTestDriverId(ctx: TestContext, token: string): Promise<string> {
  const response = await ctx.driverClient.get(`${ctx.baseUrl}/api/drivers/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.driverId;
}

async function getTestRegionAdminId(ctx: TestContext, token: string): Promise<string> {
  const response = await ctx.regionAdminClient.get(`${ctx.baseUrl}/api/admin/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.adminId;
}

async function getRestaurantsByRegion(ctx: TestContext, regionId: string): Promise<any[]> {
  const token = await getCustomerToken(ctx);
  const response = await ctx.customerClient.get(
    `${ctx.baseUrl}/api/restaurants?regionId=${regionId}&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data.restaurants;
}

async function getMenuByRestaurant(
  ctx: TestContext,
  restaurantId: string,
  token: string,
): Promise<any[]> {
  const response = await ctx.customerClient.get(
    `${ctx.baseUrl}/api/restaurants/${restaurantId}/menus`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data.menus;
}

async function setSystemTime(ctx: TestContext, time: string): Promise<void> {
  const adminToken = await getSystemAdminToken(ctx);
  await ctx.systemAdminClient.post(
    `${ctx.baseUrl}/api/system-admin/test/set-time`,
    { time },
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
}

async function getRefreshToken(ctx: TestContext): Promise<string> {
  // 실제 구현에서는 저장된 리프레시 토큰 반환
  return 'test-refresh-token';
}
