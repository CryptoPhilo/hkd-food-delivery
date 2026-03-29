export interface DeliveryFeeConfig {
  baseFee?: number;
  perKmFee?: number;
  maxDistance?: number;
}

export interface DeliveryInfo {
  distance: number;
  deliveryFee: number;
  isDeliverable: boolean;
  estimatedPickupTime: number;
  estimatedDeliveryTime: number;
  totalEstimatedTime: number;
}

interface Coordinate {
  lat: number;
  lng: number;
}

interface DeliveryFeeResult {
  fee: number;
  isDeliverable: boolean;
  distance: number;
}

interface DeliveryTimeResult {
  pickupTime: number;
  deliveryTime: number;
  totalTime: number;
}

const EARTH_RADIUS_KM = 6371;
const DEFAULT_BASE_FEE = 3000;
const DEFAULT_PER_KM_FEE = 500;
const DEFAULT_MAX_DISTANCE = 5.0;
const DEFAULT_COOKING_TIME = 20;
const DEFAULT_AVG_SPEED = 30;

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

export function calculateDeliveryFee(
  distance: number,
  config?: {
    baseFee?: number;
    perKmFee?: number;
    maxDistance?: number;
  }
): DeliveryFeeResult {
  const baseFee = config?.baseFee ?? DEFAULT_BASE_FEE;
  const perKmFee = config?.perKmFee ?? DEFAULT_PER_KM_FEE;
  const maxDistance = config?.maxDistance ?? DEFAULT_MAX_DISTANCE;
  
  if (distance > maxDistance) {
    return { fee: 0, isDeliverable: false, distance };
  }
  
  let fee = baseFee;
  
  if (distance > 2.0) {
    const extraKm = Math.ceil(distance - 2.0);
    fee += extraKm * perKmFee;
  }
  
  return { fee, isDeliverable: true, distance };
}

export function estimateDeliveryTime(
  distance: number,
  config?: {
    cookingTimeMinutes?: number;
    averageSpeedKmh?: number;
  }
): DeliveryTimeResult {
  const cookingTimeMinutes = config?.cookingTimeMinutes ?? DEFAULT_COOKING_TIME;
  const averageSpeedKmh = config?.averageSpeedKmh ?? DEFAULT_AVG_SPEED;
  
  const deliveryTimeMinutes = Math.ceil((distance / averageSpeedKmh) * 60);
  
  return {
    pickupTime: cookingTimeMinutes,
    deliveryTime: deliveryTimeMinutes,
    totalTime: cookingTimeMinutes + deliveryTimeMinutes
  };
}

export function calculateDeliveryInfo(
  restaurantLat: number,
  restaurantLng: number,
  customerLat: number,
  customerLng: number,
  deliveryConfig?: {
    baseFee?: number;
    perKmFee?: number;
    maxDistance?: number;
  },
  timeConfig?: {
    cookingTimeMinutes?: number;
    averageSpeedKmh?: number;
  }
): {
  distance: number;
  deliveryFee: number;
  isDeliverable: boolean;
  estimatedPickupTime: number;
  estimatedDeliveryTime: number;
  totalEstimatedTime: number;
} {
  const distance = calculateDistance(
    { lat: restaurantLat, lng: restaurantLng },
    { lat: customerLat, lng: customerLng }
  );
  
  const feeResult = calculateDeliveryFee(distance, deliveryConfig);
  const timeResult = estimateDeliveryTime(distance, timeConfig);
  
  return {
    distance: feeResult.distance,
    deliveryFee: feeResult.fee,
    isDeliverable: feeResult.isDeliverable,
    estimatedPickupTime: timeResult.pickupTime,
    estimatedDeliveryTime: timeResult.deliveryTime,
    totalEstimatedTime: timeResult.totalTime
  };
}
