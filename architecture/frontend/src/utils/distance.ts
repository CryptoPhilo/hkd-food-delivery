// ============================================
// 공용 거리/배달 계산 유틸리티
// 프론트엔드 전체에서 이 모듈만 사용할 것
// ============================================

/** 플랫폼 기본 최대 배달 거리 (식당별 deliveryRadius가 없을 때 사용) */
export const DEFAULT_MAX_DELIVERY_DISTANCE_KM = 10;

/** Haversine 공식으로 두 좌표 간 거리(km) 계산 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** 식당의 배달 가능 여부 판정 */
export function isWithinDeliveryRange(
  distance: number,
  restaurantDeliveryRadius?: number | null
): boolean {
  const maxDistance = restaurantDeliveryRadius ?? DEFAULT_MAX_DELIVERY_DISTANCE_KM;
  return distance <= maxDistance;
}

/** 거리 기반 배달비 계산 (프론트엔드 API 라우트용) */
export function calculateDeliveryFee(distance: number): {
  fee: number;
  isDeliverable: boolean;
} {
  if (distance > DEFAULT_MAX_DELIVERY_DISTANCE_KM)
    return { fee: 0, isDeliverable: false };
  if (distance > 4.0) return { fee: 6000, isDeliverable: true };
  if (distance > 3.0) return { fee: 5000, isDeliverable: true };
  if (distance > 2.0) return { fee: 4000, isDeliverable: true };
  if (distance > 1.0) return { fee: 3000, isDeliverable: true };
  return { fee: 2000, isDeliverable: true };
}
