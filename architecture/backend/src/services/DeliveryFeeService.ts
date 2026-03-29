import { calculateDistance, DeliveryFeeConfig, DeliveryInfo } from '../utils/haversine';

export interface DeliveryTierConfig {
  maxDistance: number;
  fee: number;
}

export interface DeliveryFeeRequest {
  restaurantId: string;
  restaurantLat: number;
  restaurantLng: number;
  customerLat: number;
  customerLng: number;
}

export interface DeliveryFeeResponse {
  distance: number;
  deliveryFee: number;
  isDeliverable: boolean;
  tiers: TierBreakdown[];
  totalFee: number;
}

interface TierBreakdown {
  tier: string;
  distance: number;
  fee: number;
}

const DEFAULT_TIERS: DeliveryTierConfig[] = [
  { maxDistance: 1.0, fee: 2000 },
  { maxDistance: 2.0, fee: 3000 },
  { maxDistance: 3.0, fee: 4000 },
  { maxDistance: 4.0, fee: 5000 },
  { maxDistance: 5.0, fee: 6000 },
];

const DEFAULT_MAX_DISTANCE = 5.0;

export class DeliveryFeeService {
  private static instance: DeliveryFeeService;
  private tiers: DeliveryTierConfig[];
  private maxDistance: number;

  static getInstance(
    tiers?: DeliveryTierConfig[],
    maxDistance?: number
  ): DeliveryFeeService {
    if (!DeliveryFeeService.instance) {
      DeliveryFeeService.instance = new DeliveryFeeService(tiers, maxDistance);
    }
    return DeliveryFeeService.instance;
  }

  constructor(tiers?: DeliveryTierConfig[], maxDistance?: number) {
    this.tiers = tiers || DEFAULT_TIERS;
    this.maxDistance = maxDistance || DEFAULT_MAX_DISTANCE;
  }

  calculateFee(distance: number): DeliveryFeeResponse {
    if (distance > this.maxDistance) {
      return {
        distance,
        deliveryFee: 0,
        isDeliverable: false,
        tiers: [],
        totalFee: 0,
      };
    }

    const tiers = this.calculateTierBreakdown(distance);
    const totalFee = tiers.reduce((sum, tier) => sum + tier.fee, 0);

    return {
      distance,
      deliveryFee: totalFee,
      isDeliverable: true,
      tiers,
      totalFee,
    };
  }

  private calculateTierBreakdown(distance: number): TierBreakdown[] {
    const breakdown: TierBreakdown[] = [];
    let remainingDistance = distance;
    let previousMaxDistance = 0;

    for (const tier of this.tiers) {
      if (remainingDistance <= 0) break;

      const tierRange = tier.maxDistance - previousMaxDistance;
      const coveredDistance = Math.min(remainingDistance, tierRange);

      if (coveredDistance > 0) {
        breakdown.push({
          tier: `${previousMaxDistance.toFixed(1)}km ~ ${tier.maxDistance.toFixed(1)}km`,
          distance: Math.round(coveredDistance * 10) / 10,
          fee: tier.fee,
        });

        remainingDistance -= coveredDistance;
      }

      previousMaxDistance = tier.maxDistance;
    }

    return breakdown;
  }

  calculateWithCoordinates(
    restaurantLat: number,
    restaurantLng: number,
    customerLat: number,
    customerLng: number
  ): DeliveryInfo & { isDeliverable: boolean } {
    const distance = calculateDistance(
      { lat: restaurantLat, lng: restaurantLng },
      { lat: customerLat, lng: customerLng }
    );

    const feeResult = this.calculateFee(distance);

    return {
      distance,
      deliveryFee: feeResult.totalFee,
      isDeliverable: feeResult.isDeliverable,
      estimatedPickupTime: 20,
      estimatedDeliveryTime: Math.ceil((distance / 30) * 60),
      totalEstimatedTime: 20 + Math.ceil((distance / 30) * 60),
    };
  }
}

export const deliveryFeeService = DeliveryFeeService.getInstance();
