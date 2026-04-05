# HKD Delivery Platform - Backend API Test Guide

## Overview

Comprehensive test suite for the HKD (한경) delivery platform backend. This document covers all test files, test categories, and execution guidelines.

## Test Files Created

### 1. **auth/auth.test.ts** (28 test cases)
Customer authentication tests for phone-based OTP flow.

**Endpoints covered:**
- `POST /api/v1/auth/phone/request` - Request OTP code
- `POST /api/v1/auth/phone/verify` - Verify OTP and get JWT tokens
- `POST /api/v1/auth/token/refresh` - Refresh access token

**Test categories:**
- Valid phone number formats (mobile, landline, various regional codes)
- Invalid phone formats and security checks
- OTP code generation and validation
- Token refresh and expiration handling
- Rate limiting
- SMS service error handling
- Full authentication flow integration

**Key Korean test data:**
- Phone: `010-1234-5678`, `010-9999-9999`
- Verification codes: 6-digit format
- Token expiry: 3600 seconds for customers

---

### 2. **admin/admin-auth.test.ts** (45 test cases)
Admin authentication, setup, and account management tests.

**Endpoints covered:**
- `POST /api/v1/admin/auth/login` - Admin login
- `POST /api/v1/admin/auth/setup` - Initial system admin setup
- `GET /api/v1/admin/auth/regions` - List regions (authenticated)
- `POST /api/v1/admin/auth/regions` - Create region (system_admin only)
- `POST /api/v1/admin/auth/accounts` - Create admin account
- `GET /api/v1/admin/auth/accounts` - List admin accounts
- `GET /api/v1/admin/auth/accounts/:id` - Get single admin account
- `PUT /api/v1/admin/auth/accounts/:id` - Update admin account
- `DELETE /api/v1/admin/auth/accounts/:id` - Delete admin account

**Test categories:**
- Valid admin credentials and login
- Inactive account rejection
- Admin account creation and validation
- Duplicate setup prevention
- Role-based access control (system_admin vs region_admin)
- Region management with KR coordinates
- Admin account CRUD operations
- Password strength validation
- Username uniqueness validation

**Key Korean test data:**
- Admin names: `관리자 김영수`, `새 관리자 박철수`
- Regions: `jeju-hangyeong` (제주 한경면), `busan-nam-gu` (부산 남구)
- Coordinates: Jeju (33.3163, 126.3108), Busan (35.0754, 129.0754)

---

### 3. **order/order.test.ts** (39 test cases)
Customer order lifecycle and operations.

**Endpoints covered:**
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders` - List customer orders
- `GET /api/v1/orders/:id` - Get order detail
- `POST /api/v1/orders/confirm/:token` - Confirm order
- `POST /api/v1/orders/cancel/:token` - Cancel order

**Test categories:**
- Order creation with valid data
- Order total calculation (subtotal + delivery fee)
- Confirmation token generation
- Missing required fields validation
- Invalid restaurant rejection
- Invalid delivery coordinates
- Item validation (quantity, price, existence)
- Restaurant availability checking
- Order confirmation with payment status
- Order cancellation with reason tracking
- Status transitions: pending → confirmed → picking_up → delivering → delivered
- Full order lifecycle flow
- Concurrent order handling

**Key Korean test data:**
- Restaurant: `restaurant-001`
- Menus: `흑돼지 구이` (25000 KRW), `보리차` (3000 KRW)
- Delivery address: `제주시 연동 123번지`
- Coordinates: 33.3163, 126.3108 (Jeju)
- Customer memo: `고추 적게 넣어주세요`

---

### 4. **admin/admin-orders.test.ts** (41 test cases)
Admin order management and lifecycle control.

**Endpoints covered:**
- `GET /api/v1/admin/orders?status=all` - List all orders
- `GET /api/v1/admin/orders?status=pending` - Filter by status
- `PUT /api/v1/admin/orders/:id/advance` - Advance order status
- `PUT /api/v1/admin/orders/:id/cancel` - Cancel order with reason
- `DELETE /api/v1/admin/orders/:id` - Delete order

**Test categories:**
- Order filtering by status (all, pending, confirmed, picking_up, delivering, delivered, cancelled)
- Multiple status filtering
- Date range filtering
- Restaurant filtering
- Sorting and pagination
- Order status advancement with validation
- Kitchen display system integration
- Driver assignment validation
- Estimated time calculations
- Invalid transition prevention
- Order cancellation with reasons
- Order deletion with audit trail
- Region-based access control

**Cancellation reasons:**
- `식당 폐점` (Restaurant closed)
- `고객 요청` (Customer request)
- `배달 불가` (Delivery impossible)
- `결제 실패` (Payment failed)
- `시스템 오류` (System error)

---

### 5. **store/restaurant.test.ts** (40 test cases)
Restaurant and menu management tests.

**Endpoints covered:**
- `GET /api/v1/restaurants` - List restaurants
- `GET /api/v1/restaurants/:id` - Get restaurant detail
- `GET /api/v1/restaurants/:id/menus` - Get restaurant menus
- `POST /api/v1/admin/restaurants` - Create restaurant
- `PUT /api/v1/admin/restaurants/:id` - Update restaurant
- `DELETE /api/v1/admin/restaurants/:id` - Delete restaurant
- `POST /api/v1/admin/restaurants/:id/menus` - Create menu
- `PUT /api/v1/admin/restaurants/:id/menus/:menuId` - Update menu
- `DELETE /api/v1/admin/restaurants/:id/menus/:menuId` - Delete menu

**Test categories:**
- Restaurant listing and filtering
- Region-based filtering
- Store type filtering (restaurant, convenience_store)
- Category filtering (korean, chinese, etc.)
- Search by restaurant name
- Sorting (rating, distance)
- Restaurant detail retrieval
- Menu listing with availability
- Age-restricted item handling
- Menu item management
- Stock/inventory tracking for convenience stores
- Admin authentication required
- Pagination support
- Coordinate validation for locations

**Key Korean test data:**
- Restaurant: `새로운 식당`
- Address: `제주시 구좌읍 종로길`
- Phone: `064-123-4567`
- Categories: `korean`, `japanese`, `chinese`
- Menu: `흑돼지 구이`
- Store types: `restaurant`, `convenience_store`

---

### 6. **driver/driver.test.ts** (39 test cases)
Driver management and delivery operations.

**Endpoints covered:**
- `POST /api/v1/drivers/start-duty` - Start shift
- `POST /api/v1/drivers/end-duty` - End shift
- `POST /api/v1/drivers/assign` - Assign order to driver
- `GET /api/v1/drivers/deliveries` - Get delivery history
- `POST /api/v1/drivers/location` - Update current location
- `PUT /api/v1/admin/drivers/:id/banking` - Update banking info
- `GET /api/v1/drivers/stats` - Get driver statistics

**Test categories:**
- Driver duty management (start/end shift)
- Timestamp tracking
- On-duty status management
- Driver creation and registration
- Region assignment validation
- Order assignment to available drivers
- Driver region validation
- Delivery history with earnings
- Location tracking
- Banking information management
- Driver statistics (deliveries, earnings, rating, acceptance rate)
- Period-based statistics (daily, weekly, monthly)
- Active delivery prevention for shift end
- Driver availability validation

**Key Korean test data:**
- Driver: `배달원 이순신`
- Phone: `010-5678-9012`
- Bank: `국민은행`
- Bank account format: Korean standard

---

### 7. **validation/input-validation.test.ts** (76 test cases)
Comprehensive input validation and security testing.

**Functions tested:**
- `validateOrderStatusFilter` - Order status validation
- `validateCreateOrder` - Order creation validation
- `validateCoordinates` - Geographic coordinate validation
- `validatePhoneRequest` - Phone number validation

**Test categories:**

#### validateOrderStatusFilter:
- Valid statuses: all, pending, confirmed, picking_up, delivering, delivered, cancelled
- Multiple comma-separated statuses
- Case sensitivity
- Invalid status rejection
- SQL injection prevention
- XSS prevention

#### validateCreateOrder:
- Required field validation
- Item validation (quantity > 0, valid prices)
- Address validation
- Coordinate requirement
- Payment method validation
- Multiple items support
- XSS in memo fields
- SQL injection prevention
- Buffer overflow prevention
- Empty items array rejection

#### validateCoordinates:
- Valid Korean coordinate ranges
- Seoul (37.5665, 126.978)
- Busan (35.0754, 129.0754)
- Jeju (33.3163, 126.3108)
- Latitude bounds: -90 to 90
- Longitude bounds: -180 to 180
- Invalid (0, 0) rejection
- Type validation
- Decimal precision support

#### validatePhoneRequest:
- Mobile formats: 010-XXXX-XXXX, 011-XXXX-XXXX, 070-XXXX-XXXX
- Landline formats: 02-XXXX-XXXX, 031-XXX-XXXX, etc.
- Format variations (with/without dashes, with spaces)
- Non-numeric character rejection
- International format rejection
- Phone normalization
- Length validation
- Security checks (null bytes, buffer overflow)

---

## Test Structure and Patterns

### Jest Configuration
- **Preset:** ts-jest
- **Environment:** Node.js
- **Root:** `<rootDir>/tests`
- **Test files:** `**/*.test.ts`
- **Setup file:** `<rootDir>/tests/setup.ts`
- **Timeout:** 10 seconds
- **Workers:** 1 (sequential execution)

### Mocking Strategy

All tests use mocked Prisma to avoid database dependencies:

```typescript
jest.mock('@prisma/client', () => {
  const mockPrismaClient = jest.fn().mockImplementation(() => ({
    user: createModelMock(),
    order: createModelMock(),
    restaurant: createModelMock(),
    driver: createModelMock(),
    adminUser: createModelMock(),
    region: createModelMock(),
    // ... other models
  }));
  return { PrismaClient: mockPrismaClient };
});
```

External services are also mocked:
- `SMSService` - SMS sending simulation
- `JWTTokenService` - JWT token generation/verification

### Test Data Patterns

**Korean Names:**
- `김영수` (Kim Young-soo)
- `박철수` (Park Chul-soo)
- `이순신` (Lee Sun-shin)

**Korean Phone Numbers:**
- Mobile: `010-1234-5678`, `011-1234-5678`, `070-1234-5678`
- Landline: `02-1234-5678`, `031-123-4567`

**Korean Addresses:**
- `제주시 연동 123번지` (Jeju City, Yeon-dong)
- `제주시 구좌읍 종로길` (Jeju City, Guza-eup)
- `제주특별자치도` (Jeju Special Self-Governing Province)

**Korean Text Examples:**
- `고추 적게 넣어주세요` (Put less chili please)
- `식당 폐점` (Restaurant closed)
- `고객 요청` (Customer request)

---

## Running Tests

### Run all tests:
```bash
npm test
```

### Run unit tests only:
```bash
npm run test:unit
```

### Run integration tests only:
```bash
npm run test:integration
```

### Run specific test file:
```bash
npm test -- auth/auth.test.ts
npm test -- admin/admin-auth.test.ts
npm test -- order/order.test.ts
```

### Run with coverage:
```bash
npm test -- --coverage
```

### Run in watch mode:
```bash
npm test -- --watch
```

---

## Test Statistics

| Test File | Cases | Lines | Size |
|-----------|-------|-------|------|
| auth.test.ts | 28 | 464 | 14.2 KB |
| admin-auth.test.ts | 45 | 630 | 20.0 KB |
| order.test.ts | 39 | 571 | 17.0 KB |
| admin-orders.test.ts | 41 | 577 | 17.8 KB |
| restaurant.test.ts | 40 | 568 | 16.9 KB |
| driver.test.ts | 39 | 554 | 16.4 KB |
| input-validation.test.ts | 76 | 602 | 17.9 KB |
| **TOTAL** | **308** | **3,966** | **120.2 KB** |

---

## Security Testing

All tests include security validations:

### XSS Prevention
- Script tag injection in addresses and memos
- HTML injection attempts
- Event handler injection

### SQL Injection Prevention
- DROP TABLE statements in input
- Comment-based injection attempts
- Union-based injection tests

### Buffer Overflow
- Excessively long input strings
- Null byte injection
- Special character handling

### Business Logic Security
- Unauthorized region access (region_admin)
- Preventing status backward transitions
- Delivered order modification prevention
- Role-based endpoint access

---

## Integration Points

Tests validate integration with:

1. **Prisma ORM** - Database modeling and queries
2. **JWT Service** - Token generation and validation
3. **SMS Service** - OTP delivery simulation
4. **Express Middleware** - Authentication and validation
5. **Regional System** - Multi-region support (Jeju, Seoul, Busan, etc.)

---

## Future Test Enhancements

Recommended additions:
- End-to-end tests with real database
- Performance/load testing for concurrent orders
- WebSocket tests for real-time updates
- Settlement calculation tests
- Age verification integration tests
- Payment gateway integration tests
- Webhook signature validation tests

---

## Notes for Development

- All tests use realistic Korean data (names, addresses, phone numbers)
- Regional coordinates are validated for Korea only
- Tests follow the project's security guidelines
- Mocked Prisma prevents test data pollution
- Tests are independent and can run in any order
