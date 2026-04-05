/**
 * 한경배달 - 입력값 검증 미들웨어 (강화 버전)
 *
 * 검증 범위:
 * - 공통 헬퍼 (전화번호, UUID, 숫자, 이메일, 좌표, 날짜, 열거형 등)
 * - 범용 검증자 (파라미터 ID, 페이지네이션, 좌표, 텍스트 길이 등)
 * - 라우트별 전문 검증자 (주문, 식당, 메뉴, 배달원, 정산, 설정 등)
 */
import { Request, Response, NextFunction } from 'express';

// ============================================
// 표준 카테고리 목록
// ============================================
export const RESTAURANT_CATEGORIES = ['한식', '중식', '양식/피자', '치킨', '분식', '고기/구이', '횟집', '카페', '기타'] as const;
export type RestaurantCategory = typeof RESTAURANT_CATEGORIES[number];

// ============================================
// 공통 검증 헬퍼
// ============================================

/** 한국 전화번호 형식 검증 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[-\s()]/g, '');
  // 한국 휴대폰 (01X-XXXX-XXXX)
  if (/^01[016789]\d{7,8}$/.test(cleaned)) return true;
  // 국제 번호 (+국가코드 포함, 7~15자리)
  if (/^\+?\d{7,15}$/.test(cleaned)) return true;
  return false;
}

/** UUID 형식 검증 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** 양의 정수 검증 */
export function isPositiveInt(value: any): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

/** 0 이상의 정수 검증 */
export function isNonNegativeInt(value: any): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0;
}

/** 양의 숫자 검증 (소수 포함) */
export function isPositiveNumber(value: any): boolean {
  const n = Number(value);
  return !isNaN(n) && isFinite(n) && n > 0;
}

/** 0 이상의 숫자 검증 */
export function isNonNegativeNumber(value: any): boolean {
  const n = Number(value);
  return !isNaN(n) && isFinite(n) && n >= 0;
}

/** 이메일 형식 검증 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** 위도 검증 (-90 ~ 90) */
export function isValidLatitude(lat: any): boolean {
  const n = Number(lat);
  return !isNaN(n) && isFinite(n) && n >= -90 && n <= 90;
}

/** 경도 검증 (-180 ~ 180) */
export function isValidLongitude(lng: any): boolean {
  const n = Number(lng);
  return !isNaN(n) && isFinite(n) && n >= -180 && n <= 180;
}

/** ISO 날짜 형식 검증 (YYYY-MM-DD) */
export function isValidDateString(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

/** ISO datetime 형식 검증 */
export function isValidISODatetime(datetime: string): boolean {
  return !isNaN(Date.parse(datetime));
}

/** 시간 형식 검증 (HH:mm) */
export function isValidTimeString(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [h, m] = time.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** 정산 기간 형식 검증 (YYYY-MM) */
export function isValidPeriod(period: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(period)) return false;
  const [y, m] = period.split('-').map(Number);
  return y >= 2020 && y <= 2100 && m >= 1 && m <= 12;
}

/** 안전한 문자열 검증 (위험 문자 제거) */
export function isSafeString(str: string, maxLength: number = 500): boolean {
  if (typeof str !== 'string') return false;
  if (str.length > maxLength) return false;
  // 스크립트 태그, SQL 주입 패턴 차단
  if (/<script|javascript:|on\w+\s*=|UNION\s+SELECT|DROP\s+TABLE|INSERT\s+INTO|DELETE\s+FROM/i.test(str)) return false;
  return true;
}

/** 안전한 ID 검증 (UUID 또는 CUID 등) */
export function isSafeId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length > 100) return false;
  if (/[<>"';\\]/.test(id)) return false;
  return true;
}

/** URL 형식 검증 */
export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}

// ============================================
// 에러 응답 헬퍼
// ============================================

function validationError(res: Response, errors: string | string[]) {
  const errorList = Array.isArray(errors) ? errors : [errors];
  return res.status(400).json({
    success: false,
    error: '입력값 검증 실패',
    details: errorList,
  });
}

// ============================================
// 범용 검증 미들웨어
// ============================================

/**
 * URL 파라미터 ID 검증
 * 사용: router.get('/:id', validateParamId(), handler)
 *       router.get('/:orderId', validateParamId('orderId'), handler)
 */
export const validateParamId = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    if (!id || !isSafeId(id)) {
      return validationError(res, `유효하지 않은 ${paramName} 형식입니다`);
    }
    next();
  };
};

/**
 * 페이지네이션 쿼리 검증 + 기본값 설정
 * 사용: router.get('/', validatePagination(), handler)
 */
export const validatePagination = (maxLimit: number = 100) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { page, limit } = req.query;

    if (page !== undefined) {
      const p = Number(page);
      if (!Number.isInteger(p) || p < 1) {
        return validationError(res, 'page는 1 이상의 정수여야 합니다');
      }
    }

    if (limit !== undefined) {
      const l = Number(limit);
      if (!Number.isInteger(l) || l < 1 || l > maxLimit) {
        return validationError(res, `limit는 1~${maxLimit} 범위의 정수여야 합니다`);
      }
    }

    next();
  };
};

/**
 * 좌표 쿼리 파라미터 검증
 * 사용: router.get('/', validateCoordinates(), handler)
 */
export const validateCoordinates = (required: boolean = false) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { lat, lng } = req.query;

    if (required && (!lat || !lng)) {
      return validationError(res, '위도(lat)와 경도(lng)는 필수입니다');
    }

    if (lat !== undefined && !isValidLatitude(lat)) {
      return validationError(res, '위도(lat)는 -90 ~ 90 범위의 숫자여야 합니다');
    }

    if (lng !== undefined && !isValidLongitude(lng)) {
      return validationError(res, '경도(lng)는 -180 ~ 180 범위의 숫자여야 합니다');
    }

    next();
  };
};

/**
 * 열거형 쿼리 파라미터 검증
 * 사용: router.get('/', validateEnum('status', ['pending','confirmed','completed']), handler)
 */
export const validateEnum = (paramName: string, allowedValues: string[], source: 'query' | 'body' = 'query') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = source === 'query' ? req.query[paramName] : req.body[paramName];

    if (value !== undefined && !allowedValues.includes(value as string)) {
      return validationError(res, `${paramName}은(는) 다음 중 하나여야 합니다: ${allowedValues.join(', ')}`);
    }

    next();
  };
};

/**
 * 전화번호 쿼리/파라미터 검증
 * 사용: router.get('/status/:phone', validatePhoneParam('phone'), handler)
 */
export const validatePhoneParam = (paramName: string = 'phone', source: 'params' | 'query' = 'params') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const phone = source === 'params' ? req.params[paramName] : req.query[paramName] as string;

    if (phone && !isValidPhone(phone)) {
      return validationError(res, '올바른 전화번호 형식이 아닙니다 (예: 01012345678)');
    }

    next();
  };
};

/**
 * 날짜 쿼리 파라미터 검증
 * 사용: router.get('/', validateDateParam('date'), handler)
 */
export const validateDateParam = (...paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const name of paramNames) {
      const value = req.query[name] as string;
      if (value && !isValidDateString(value)) {
        return validationError(res, `${name}은(는) YYYY-MM-DD 형식이어야 합니다`);
      }
    }
    next();
  };
};

/**
 * 정산 기간 검증
 * 사용: router.get('/', validatePeriodParam(), handler)
 */
export const validatePeriodParam = (source: 'query' | 'body' = 'query') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const period = source === 'query' ? req.query.period as string : req.body.period;

    if (period && !isValidPeriod(period)) {
      return validationError(res, '기간(period)은 YYYY-MM 형식이어야 합니다');
    }

    next();
  };
};

// ============================================
// 주문 관련 검증
// ============================================

/**
 * 주문 생성 요청 검증
 */
export const validateCreateOrder = (req: Request, res: Response, next: NextFunction) => {
  const { userId, phone, restaurantId, items, deliveryAddress, deliveryLat, deliveryLng, customerMemo } = req.body;
  const errors: string[] = [];

  if (!userId && !phone) {
    errors.push('userId 또는 phone이 필요합니다');
  }

  if (phone && !isValidPhone(phone)) {
    errors.push('올바른 전화번호 형식이 아닙니다');
  }

  if (!restaurantId || !isSafeId(restaurantId)) {
    errors.push('유효한 restaurantId는 필수입니다');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push('최소 1개 이상의 주문 항목이 필요합니다');
  } else if (items.length > 50) {
    errors.push('주문 항목은 최대 50개까지 가능합니다');
  } else {
    items.forEach((item: any, index: number) => {
      if (!item.menuId || !isSafeId(item.menuId)) {
        errors.push(`항목 ${index + 1}: 유효한 menuId가 필요합니다`);
      }
      if (!isPositiveInt(item.quantity) || Number(item.quantity) > 100) {
        errors.push(`항목 ${index + 1}: 수량은 1~100 범위의 정수여야 합니다`);
      }
    });
  }

  if (!deliveryAddress || typeof deliveryAddress !== 'string' || deliveryAddress.trim().length < 5) {
    errors.push('올바른 배달 주소가 필요합니다 (최소 5자)');
  } else if (deliveryAddress.length > 200) {
    errors.push('배달 주소는 200자 이내여야 합니다');
  }

  if (deliveryLat !== undefined && !isValidLatitude(deliveryLat)) {
    errors.push('배달 위도(deliveryLat)는 -90 ~ 90 범위여야 합니다');
  }

  if (deliveryLng !== undefined && !isValidLongitude(deliveryLng)) {
    errors.push('배달 경도(deliveryLng)는 -180 ~ 180 범위여야 합니다');
  }

  if (customerMemo !== undefined && customerMemo !== null) {
    if (typeof customerMemo !== 'string' || customerMemo.length > 500) {
      errors.push('고객 메모는 500자 이내의 문자열이어야 합니다');
    }
    if (!isSafeString(customerMemo, 500)) {
      errors.push('고객 메모에 허용되지 않는 내용이 포함되어 있습니다');
    }
  }

  if (errors.length > 0) {
    return validationError(res, errors);
  }

  next();
};

/**
 * 주문 상태 변경 검증 (pickup-time)
 */
export const validatePickupTime = (req: Request, res: Response, next: NextFunction) => {
  const { pickupTime, restaurantMemo } = req.body;
  const errors: string[] = [];

  if (pickupTime !== undefined) {
    if (typeof pickupTime !== 'string' || !isValidISODatetime(pickupTime)) {
      errors.push('pickupTime은 유효한 ISO 날짜/시간 형식이어야 합니다');
    }
  }

  if (restaurantMemo !== undefined && restaurantMemo !== null) {
    if (typeof restaurantMemo !== 'string' || !isSafeString(restaurantMemo, 500)) {
      errors.push('식당 메모는 500자 이내의 안전한 문자열이어야 합니다');
    }
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 주문 픽업 검증
 */
export const validateOrderPickup = (req: Request, res: Response, next: NextFunction) => {
  const { restaurantPaidAmount } = req.body;

  if (restaurantPaidAmount !== undefined) {
    if (!isNonNegativeNumber(restaurantPaidAmount)) {
      return validationError(res, '식당 지급 금액은 0 이상의 숫자여야 합니다');
    }
  }

  next();
};

// ============================================
// 인증 관련 검증
// ============================================

/**
 * 전화번호 인증 요청 검증
 */
export const validatePhoneRequest = (req: Request, res: Response, next: NextFunction) => {
  const { phone } = req.body;

  if (!phone) {
    return validationError(res, '전화번호가 필요합니다');
  }

  if (!isValidPhone(phone)) {
    return validationError(res, '올바른 한국 전화번호 형식이 아닙니다 (예: 01012345678)');
  }

  next();
};

/**
 * 인증 코드 검증 요청 검증
 */
export const validatePhoneVerify = (req: Request, res: Response, next: NextFunction) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return validationError(res, '전화번호와 인증 코드가 필요합니다');
  }

  if (!isValidPhone(phone)) {
    return validationError(res, '올바른 전화번호 형식이 아닙니다');
  }

  if (!/^\d{6}$/.test(code)) {
    return validationError(res, '인증 코드는 6자리 숫자여야 합니다');
  }

  next();
};

/**
 * 토큰 갱신 검증
 */
export const validateTokenRefresh = (req: Request, res: Response, next: NextFunction) => {
  const { refresh_token } = req.body;

  if (!refresh_token || typeof refresh_token !== 'string' || refresh_token.length < 10 || refresh_token.length > 2000) {
    return validationError(res, '유효한 refresh_token이 필요합니다');
  }

  next();
};

// ============================================
// 식당/매장 관련 검증
// ============================================

/**
 * 식당/매장 생성 요청 검증
 */
export const validateCreateRestaurant = (req: Request, res: Response, next: NextFunction) => {
  const { name, address, latitude, longitude, phone, businessHours, storeType, brandName, deliveryRadius, rating, category } = req.body;
  const errors: string[] = [];

  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
    errors.push('매장 이름은 1~100자 범위의 문자열이어야 합니다');
  }

  if (!address || typeof address !== 'string' || address.trim().length < 5 || address.length > 200) {
    errors.push('주소는 5~200자 범위의 문자열이어야 합니다');
  }

  if (latitude !== undefined && !isValidLatitude(latitude)) {
    errors.push('위도는 -90 ~ 90 범위의 숫자여야 합니다');
  }

  if (longitude !== undefined && !isValidLongitude(longitude)) {
    errors.push('경도는 -180 ~ 180 범위의 숫자여야 합니다');
  }

  if (phone && !isSafeString(phone, 20)) {
    errors.push('전화번호 형식이 올바르지 않습니다');
  }

  if (businessHours && typeof businessHours === 'string') {
    if (!/\d{2}:\d{2}-\d{2}:\d{2}/.test(businessHours)) {
      errors.push('영업시간에 HH:MM-HH:MM 형식이 포함되어야 합니다');
    }
    if (businessHours.length > 200) {
      errors.push('영업시간 정보는 200자 이내여야 합니다');
    }
  }

  if (category && typeof category === 'string' && category.length > 0) {
    if (storeType !== 'convenience_store' && !(RESTAURANT_CATEGORIES as readonly string[]).includes(category)) {
      errors.push(`카테고리는 다음 중 하나여야 합니다: ${RESTAURANT_CATEGORIES.join(', ')}`);
    }
  }

  if (storeType && !['restaurant', 'convenience_store'].includes(storeType)) {
    errors.push('storeType은 restaurant 또는 convenience_store여야 합니다');
  }

  if (brandName && (typeof brandName !== 'string' || brandName.length > 50)) {
    errors.push('브랜드명은 50자 이내여야 합니다');
  }

  if (deliveryRadius !== undefined && !isPositiveNumber(deliveryRadius)) {
    errors.push('배달 반경은 양의 숫자여야 합니다');
  }

  if (rating !== undefined) {
    const r = Number(rating);
    if (isNaN(r) || r < 0 || r > 5) {
      errors.push('평점은 0~5 범위여야 합니다');
    }
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 식당/매장 수정 요청 검증
 */
export const validateUpdateRestaurant = (req: Request, res: Response, next: NextFunction) => {
  const { latitude, longitude, phone, businessHours, storeType, deliveryRadius, rating, name, address, category } = req.body;
  const errors: string[] = [];

  if (category !== undefined && category !== null && typeof category === 'string' && category.length > 0) {
    if (storeType !== 'convenience_store' && !(RESTAURANT_CATEGORIES as readonly string[]).includes(category)) {
      errors.push(`카테고리는 다음 중 하나여야 합니다: ${RESTAURANT_CATEGORIES.join(', ')}`);
    }
  }

  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 1 || name.length > 100)) {
    errors.push('매장 이름은 1~100자 범위여야 합니다');
  }

  if (address !== undefined && (typeof address !== 'string' || address.length > 200)) {
    errors.push('주소는 200자 이내여야 합니다');
  }

  if (latitude !== undefined && !isValidLatitude(latitude)) {
    errors.push('위도는 -90 ~ 90 범위여야 합니다');
  }

  if (longitude !== undefined && !isValidLongitude(longitude)) {
    errors.push('경도는 -180 ~ 180 범위여야 합니다');
  }

  if (businessHours !== undefined && businessHours !== null && typeof businessHours === 'string' && businessHours.length > 0) {
    // HH:MM-HH:MM 기본 형식을 포함하면 허용 (뒤에 휴무일, 브레이크타임 등 부가 정보 가능)
    if (!/\d{2}:\d{2}-\d{2}:\d{2}/.test(businessHours)) {
      errors.push('영업시간에 HH:MM-HH:MM 형식이 포함되어야 합니다');
    }
    if (businessHours.length > 200) {
      errors.push('영업시간 정보는 200자 이내여야 합니다');
    }
  }

  if (storeType !== undefined && !['restaurant', 'convenience_store'].includes(storeType)) {
    errors.push('storeType은 restaurant 또는 convenience_store여야 합니다');
  }

  if (deliveryRadius !== undefined && deliveryRadius !== null && !isPositiveNumber(deliveryRadius)) {
    errors.push('배달 반경은 양의 숫자여야 합니다');
  }

  if (rating !== undefined && rating !== null) {
    const r = Number(rating);
    if (isNaN(r) || r < 0 || r > 5) errors.push('평점은 0~5 범위여야 합니다');
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

// ============================================
// 메뉴 관련 검증
// ============================================

/**
 * 메뉴 생성/수정 요청 검증
 */
export const validateMenu = (req: Request, res: Response, next: NextFunction) => {
  const { name, price, imageUrl, description, category, stock, ageRestriction } = req.body;
  const errors: string[] = [];

  if (req.method === 'POST') {
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      errors.push('메뉴명은 필수입니다');
    }
    if (price === undefined || !isPositiveInt(price)) {
      errors.push('가격은 양의 정수여야 합니다');
    }
  }

  if (name !== undefined && (typeof name !== 'string' || name.length > 100)) {
    errors.push('메뉴명은 100자 이내여야 합니다');
  }

  if (price !== undefined && (typeof price !== 'number' || price < 0 || price > 10000000)) {
    errors.push('가격은 0 ~ 10,000,000원 범위여야 합니다');
  }

  if (imageUrl !== undefined && imageUrl !== null && typeof imageUrl === 'string' && imageUrl.length > 0) {
    if (!isValidUrl(imageUrl)) {
      errors.push('이미지 URL 형식이 올바르지 않습니다');
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string' || description.length > 500) {
      errors.push('설명은 500자 이내여야 합니다');
    }
  }

  if (category !== undefined && category !== null) {
    if (typeof category !== 'string' || category.length > 50) {
      errors.push('카테고리는 50자 이내여야 합니다');
    }
  }

  if (stock !== undefined && stock !== null) {
    if (!isNonNegativeInt(stock)) {
      errors.push('재고는 0 이상의 정수여야 합니다');
    }
  }

  if (ageRestriction !== undefined && !['none', 'teen', 'adult'].includes(ageRestriction)) {
    errors.push('ageRestriction은 none, teen, adult 중 하나여야 합니다');
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 재고 수정 검증
 */
export const validateStockUpdate = (req: Request, res: Response, next: NextFunction) => {
  const { quantity, operation } = req.body;
  const errors: string[] = [];

  if (quantity === undefined || !isNonNegativeInt(quantity)) {
    errors.push('수량(quantity)은 0 이상의 정수여야 합니다');
  }

  if (operation && !['add', 'subtract', 'set'].includes(operation)) {
    errors.push('operation은 add, subtract, set 중 하나여야 합니다');
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

// ============================================
// 배달원 관련 검증
// ============================================

/**
 * 배달원 등록/출근 검증
 */
export const validateDriverRegister = (req: Request, res: Response, next: NextFunction) => {
  const { phone, name, cardNumber } = req.body;
  const errors: string[] = [];

  if (!phone || !isValidPhone(phone)) {
    errors.push('올바른 전화번호가 필요합니다');
  }

  if (name !== undefined && name !== null) {
    if (typeof name !== 'string' || name.trim().length < 1 || name.length > 50) {
      errors.push('이름은 1~50자 범위여야 합니다');
    }
  }

  if (cardNumber !== undefined && cardNumber !== null) {
    if (typeof cardNumber !== 'string' || cardNumber.length > 30) {
      errors.push('카드 번호는 30자 이내여야 합니다');
    }
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 배달원 배차 검증
 */
export const validateDriverAssign = (req: Request, res: Response, next: NextFunction) => {
  const { phone } = req.body;

  if (!phone || !isValidPhone(phone)) {
    return validationError(res, '올바른 전화번호가 필요합니다');
  }

  next();
};

/**
 * 배달원 일괄 배차 검증
 */
export const validateDriverAssignBatch = (req: Request, res: Response, next: NextFunction) => {
  const { orderIds, phone } = req.body;
  const errors: string[] = [];

  if (!phone || !isValidPhone(phone)) {
    errors.push('올바른 전화번호가 필요합니다');
  }

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    errors.push('하나 이상의 주문 ID가 필요합니다');
  } else if (orderIds.length > 50) {
    errors.push('일괄 배차는 최대 50건까지 가능합니다');
  } else {
    orderIds.forEach((id: any, i: number) => {
      if (!isSafeId(String(id))) {
        errors.push(`주문 ID ${i + 1}번이 유효하지 않습니다`);
      }
    });
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 배달원 수정 검증
 */
export const validateDriverUpdate = (req: Request, res: Response, next: NextFunction) => {
  const { name, cardNumber } = req.body;
  const errors: string[] = [];

  if (name !== undefined && (typeof name !== 'string' || name.length > 50)) {
    errors.push('이름은 50자 이내여야 합니다');
  }

  if (cardNumber !== undefined && (typeof cardNumber !== 'string' || cardNumber.length > 30)) {
    errors.push('카드 번호는 30자 이내여야 합니다');
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

// ============================================
// 정산 관련 검증
// ============================================

/**
 * 정산 생성 검증
 */
export const validateSettlementGenerate = (req: Request, res: Response, next: NextFunction) => {
  const { period, serviceFeeRate, taxRate } = req.body;
  const errors: string[] = [];

  if (!period || !isValidPeriod(period)) {
    errors.push('기간(period)은 YYYY-MM 형식이어야 합니다');
  }

  if (serviceFeeRate !== undefined) {
    const r = Number(serviceFeeRate);
    if (isNaN(r) || r < 0 || r > 1) {
      errors.push('서비스 수수료율은 0~1(0%~100%) 범위여야 합니다');
    }
  }

  if (taxRate !== undefined) {
    const r = Number(taxRate);
    if (isNaN(r) || r < 0 || r > 1) {
      errors.push('세율은 0~1(0%~100%) 범위여야 합니다');
    }
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 정산 지급 확인 검증
 */
export const validateSettlementPayment = (req: Request, res: Response, next: NextFunction) => {
  const { paidAmount, paidAt, notes } = req.body;
  const errors: string[] = [];

  if (paidAmount !== undefined && !isPositiveNumber(paidAmount)) {
    errors.push('지급 금액은 양의 숫자여야 합니다');
  }

  if (paidAt !== undefined && !isValidISODatetime(paidAt)) {
    errors.push('지급일(paidAt)은 유효한 날짜/시간 형식이어야 합니다');
  }

  if (notes !== undefined && notes !== null) {
    if (typeof notes !== 'string' || !isSafeString(notes, 1000)) {
      errors.push('비고는 1000자 이내의 안전한 문자열이어야 합니다');
    }
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 정산 반려 검증
 */
export const validateSettlementReject = (req: Request, res: Response, next: NextFunction) => {
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || reason.trim().length < 1) {
    return validationError(res, '반려 사유는 필수입니다');
  }

  if (reason.length > 500) {
    return validationError(res, '반려 사유는 500자 이내여야 합니다');
  }

  next();
};

/**
 * 정산 보너스/패널티 조정 검증
 */
export const validateSettlementAdjust = (req: Request, res: Response, next: NextFunction) => {
  const { bonus, penalty, notes } = req.body;
  const errors: string[] = [];

  if (bonus !== undefined && !isNonNegativeNumber(bonus)) {
    errors.push('보너스는 0 이상의 숫자여야 합니다');
  }

  if (penalty !== undefined && !isNonNegativeNumber(penalty)) {
    errors.push('패널티는 0 이상의 숫자여야 합니다');
  }

  if (notes !== undefined && (typeof notes !== 'string' || !isSafeString(notes, 500))) {
    errors.push('비고는 500자 이내의 안전한 문자열이어야 합니다');
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 정산 일괄 처리 검증
 */
export const validateSettlementBatch = (req: Request, res: Response, next: NextFunction) => {
  const { settlementIds } = req.body;

  if (!settlementIds || !Array.isArray(settlementIds) || settlementIds.length === 0) {
    return validationError(res, '하나 이상의 정산 ID가 필요합니다');
  }

  if (settlementIds.length > 100) {
    return validationError(res, '일괄 처리는 최대 100건까지 가능합니다');
  }

  for (let i = 0; i < settlementIds.length; i++) {
    if (!isSafeId(String(settlementIds[i]))) {
      return validationError(res, `정산 ID ${i + 1}번이 유효하지 않습니다`);
    }
  }

  next();
};

// ============================================
// 설정 관련 검증
// ============================================

/**
 * 플랫폼 운영시간 설정 검증
 */
export const validatePlatformHours = (req: Request, res: Response, next: NextFunction) => {
  const { openTime, closeTime, isActive } = req.body;
  const errors: string[] = [];

  if (openTime !== undefined && !isValidTimeString(openTime)) {
    errors.push('개점 시간은 HH:mm 형식이어야 합니다');
  }

  if (closeTime !== undefined && !isValidTimeString(closeTime)) {
    errors.push('폐점 시간은 HH:mm 형식이어야 합니다');
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    errors.push('isActive는 boolean 타입이어야 합니다');
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 배달비 설정 검증
 */
export const validateDeliveryFeeSettings = (req: Request, res: Response, next: NextFunction) => {
  const { baseFee, perKmFee, maxDistance, freeDeliveryThreshold } = req.body;
  const errors: string[] = [];

  if (baseFee !== undefined && !isNonNegativeNumber(baseFee)) {
    errors.push('기본 배달비는 0 이상의 숫자여야 합니다');
  }

  if (perKmFee !== undefined && !isNonNegativeNumber(perKmFee)) {
    errors.push('km당 배달비는 0 이상의 숫자여야 합니다');
  }

  if (maxDistance !== undefined) {
    const d = Number(maxDistance);
    if (isNaN(d) || d <= 0 || d > 100) {
      errors.push('최대 배달 거리는 0~100km 범위여야 합니다');
    }
  }

  if (freeDeliveryThreshold !== undefined && !isNonNegativeNumber(freeDeliveryThreshold)) {
    errors.push('무료 배달 기준금액은 0 이상의 숫자여야 합니다');
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

// ============================================
// Webhook 관련 검증
// ============================================

/**
 * SMS 웹훅 검증
 */
export const validateSmsWebhook = (req: Request, res: Response, next: NextFunction) => {
  const { from, content } = req.body;
  const errors: string[] = [];

  if (!from || typeof from !== 'string' || from.length > 20) {
    errors.push('발신 번호(from)는 필수이며 20자 이내여야 합니다');
  }

  if (!content || typeof content !== 'string' || content.length > 2000) {
    errors.push('내용(content)은 필수이며 2000자 이내여야 합니다');
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 관리자 설정 변경 검증
 */
export const validateAdminSettings = (req: Request, res: Response, next: NextFunction) => {
  const { key, value } = req.body;
  const errors: string[] = [];

  if (!key || typeof key !== 'string' || key.length > 100) {
    errors.push('설정 키(key)는 필수이며 100자 이내여야 합니다');
  }

  if (value === undefined) {
    errors.push('설정 값(value)은 필수입니다');
  }

  // 키에 위험 문자 차단
  if (key && !isSafeString(key, 100)) {
    errors.push('설정 키에 허용되지 않는 문자가 포함되어 있습니다');
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 이미지 URL 검증
 */
export const validateImageUrl = (req: Request, res: Response, next: NextFunction) => {
  const { imageUrl } = req.body;

  if (!imageUrl || typeof imageUrl !== 'string') {
    return validationError(res, '이미지 URL이 필요합니다');
  }

  if (!isValidUrl(imageUrl)) {
    return validationError(res, '올바른 이미지 URL 형식이 아닙니다');
  }

  next();
};

/**
 * 관리자 주문 상태 필터 검증
 */
export const validateOrderStatusFilter = (req: Request, res: Response, next: NextFunction) => {
  const { status } = req.query;
  const validStatuses = ['all', 'pending', 'pending_confirmation', 'confirmed', 'order_confirmed', 'preparing', 'pickup_ready', 'picking_up', 'picked_up', 'delivering', 'delivered', 'completed', 'cancelled'];

  if (status && !validStatuses.includes(status as string)) {
    return validationError(res, `주문 상태는 다음 중 하나여야 합니다: ${validStatuses.join(', ')}`);
  }

  next();
};

/**
 * 스크래핑 요청 검증
 */
export const validateScrape = (req: Request, res: Response, next: NextFunction) => {
  const { area, maxResults } = req.body;
  const errors: string[] = [];

  if (!area || typeof area !== 'string' || area.trim().length < 1 || area.length > 100) {
    errors.push('검색 지역(area)은 1~100자 범위의 문자열이어야 합니다');
  }

  if (!isSafeString(area || '', 100)) {
    errors.push('검색 지역에 허용되지 않는 문자가 포함되어 있습니다');
  }

  if (maxResults !== undefined) {
    if (!isPositiveInt(maxResults) || Number(maxResults) > 200) {
      errors.push('최대 결과 수는 1~200 범위의 정수여야 합니다');
    }
  }

  if (errors.length > 0) return validationError(res, errors);
  next();
};

/**
 * 검색 쿼리 검증
 */
export const validateSearchQuery = (req: Request, res: Response, next: NextFunction) => {
  const { search } = req.query;

  if (search && typeof search === 'string') {
    if (search.length > 100) {
      return validationError(res, '검색어는 100자 이내여야 합니다');
    }
    if (!isSafeString(search, 100)) {
      return validationError(res, '검색어에 허용되지 않는 문자가 포함되어 있습니다');
    }
  }

  next();
};
