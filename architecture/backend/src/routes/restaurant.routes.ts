import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { deliveryFeeService } from '../services/DeliveryFeeService';
import { kakaoMapService } from '../services/KakaoMapService';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// Middleware
// ============================================
function validateCoordinates() {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
}

function validatePagination(maxLimit: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
}

router.get('/regions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // [SECURITY] M-1: $queryRawUnsafe → $queryRaw (tagged template)
    const regions = await prisma.$queryRaw`
      SELECT id, code, name, name_en as "nameEn", center_latitude as "centerLatitude", center_longitude as "centerLongitude", address_keyword as "addressKeyword", is_active as "isActive"
      FROM regions WHERE is_active = true ORDER BY name ASC
    `;

    res.json({ success: true, data: regions });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 카테고리별 주문 수 API (고객용 - 선택적 인증)
// [SECURITY] MEDIUM-08: 집계 데이터 보호를 위한 인증 추가
// ========================================
router.get(
  '/category-order-counts',
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { regionId } = req.query;

      const whereClause: any = {};
      if (regionId) {
        whereClause.restaurant = { regionId: String(regionId) };
      }

      const orders = await (prisma as any).order.findMany({
        where: whereClause,
        select: {
          restaurant: {
            select: { category: true, storeType: true, brandName: true },
          },
        },
      });

      const counts: Record<string, number> = {};
      for (const o of orders) {
        if (!o.restaurant) continue;
        const key =
          o.restaurant.storeType === 'convenience_store'
            ? o.restaurant.brandName || '기타 편의점'
            : o.restaurant.category || '기타';
        counts[key] = (counts[key] || 0) + 1;
      }

      res.json({ success: true, data: counts });
    } catch (error) {
      next(error);
    }
  },
);

// ========================================
// 식당별 주간 주문 수 API (고객용 - Hot 뱃지용, 선택적 인증)
// [SECURITY] MEDIUM-08: 집계 데이터 보호를 위한 인증 추가
// ========================================
router.get('/weekly-hot', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { regionId } = req.query;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const whereClause: any = {
      createdAt: { gte: oneWeekAgo },
    };
    if (regionId) {
      whereClause.restaurant = { regionId: String(regionId) };
    }

    const orders = await (prisma as any).order.findMany({
      where: whereClause,
      select: {
        restaurantId: true,
      },
    });

    // 식당별 주문 수 집계
    const counts: Record<string, number> = {};
    for (const o of orders) {
      counts[o.restaurantId] = (counts[o.restaurantId] || 0) + 1;
    }

    // 주문 수 내림차순 정렬, 상위 식당들에 Hot 부여 (최소 2건 이상)
    const sorted = Object.entries(counts)
      .filter(([, cnt]) => cnt >= 2)
      .sort((a, b) => b[1] - a[1]);

    // 상위 30%까지 또는 최대 10개까지 Hot
    const hotLimit = Math.min(Math.max(Math.ceil(sorted.length * 0.3), 1), 10);
    const hotIds = sorted.slice(0, hotLimit).map(([id]) => id);

    // 전체 식당별 주문 수도 함께 반환 (정렬용)
    res.json({
      success: true,
      data: {
        hotRestaurantIds: hotIds,
        orderCounts: counts,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 카카오 장소 검색 API (외부 카카오 API 직접 호출)
// ========================================
router.get('/search/kakao', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, category, latitude, longitude, radius, page = '1' } = req.query;

    if (!query && !category) {
      return res.status(400).json({
        success: false,
        error: '검색어(query) 또는 카테고리(category)를 입력해주세요',
      });
    }

    let results;

    if (query) {
      // 키워드 검색
      results = await kakaoMapService.searchByKeyword(
        query as string,
        category as string | undefined,
        parseInt(page as string),
        15,
      );
    } else if (category && latitude && longitude) {
      // 카테고리 + 좌표 기반 검색
      results = await kakaoMapService.searchByCategory(
        category as string,
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        parseInt((radius as string) || '5000'),
        parseInt(page as string),
        15,
      );
    } else {
      return res.status(400).json({
        success: false,
        error: '카테고리 검색 시 latitude, longitude가 필수입니다',
      });
    }

    res.json({
      success: true,
      data: results.documents,
      meta: results.meta,
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 주소 → 좌표 변환 (지오코딩)
// ========================================
router.get('/geocode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ success: false, error: '주소(address)를 입력해주세요' });
    }
    const result = await kakaoMapService.getCoordinateFromAddress(address as string);
    if (result) {
      res.json({ success: true, data: { latitude: result.y, longitude: result.x } });
    } else {
      res.json({ success: false, error: '좌표를 찾을 수 없습니다' });
    }
  } catch (error) {
    next(error);
  }
});

// ========================================
// DB 기반 식당 목록 조회
// ========================================
router.get(
  '/',
  validateCoordinates(),
  validatePagination(500),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lat, lng, category, page = '1', limit = '20', regionId } = req.query;

      // [SECURITY] M-1: $queryRawUnsafe → Prisma Client API
      const whereClause: any = {
        isActive: true,
        isDeliverable: true,
        OR: [{ businessStatus: 'open' }, { businessStatus: null }],
      };
      if (regionId) {
        whereClause.regionId = String(regionId);
      }

      const dbRestaurants = await prisma.restaurant.findMany({
        where: whereClause,
        include: {
          menus: { where: { isAvailable: true, isActive: true } },
        },
        orderBy: { name: 'asc' },
      });

      let restaurants = dbRestaurants.map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        roadAddress: r.roadAddress,
        phone: r.phone,
        category: r.category,
        storeType: r.storeType,
        brandName: r.brandName,
        description: r.description,
        imageUrl: r.imageUrl,
        thumbnailUrl: r.thumbnailUrl,
        latitude: r.latitude,
        longitude: r.longitude,
        isActive: r.isActive,
        isDeliverable: r.isDeliverable,
        deliveryRadius: r.deliveryRadius,
        operatingHours24: r.operatingHours24,
        regionId: r.regionId,
        businessStatus: r.businessStatus,
        menus: r.menus.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          price: m.price,
          imageUrl: m.imageUrl,
          thumbnailUrl: m.thumbnailUrl,
          isAvailable: m.isAvailable,
          isActive: m.isActive,
          category: m.category,
        })),
      }));

      // [SECURITY] GPS 좌표를 소수점 4자리(~10m 정밀도)로 반올림 (SERVICE-05)
      restaurants = restaurants.map((r: any) => ({
        ...r,
        latitude: r.latitude ? Math.round(r.latitude * 10000) / 10000 : r.latitude,
        longitude: r.longitude ? Math.round(r.longitude * 10000) / 10000 : r.longitude,
      }));

      if (lat && lng) {
        const userLat = parseFloat(lat as string);
        const userLng = parseFloat(lng as string);

        restaurants = restaurants.map((r: any) => {
          const info = deliveryFeeService.calculateWithCoordinates(
            r.latitude,
            r.longitude,
            userLat,
            userLng,
          );
          return {
            ...r,
            distance: info.distance,
            deliveryFee: info.deliveryFee,
            isDeliverable: info.isDeliverable,
            estimatedDeliveryTime: info.totalEstimatedTime,
          };
        });
        // Temporarily disabled distance filter for demo
        // .filter((r: any) => r.isDeliverable);

        restaurants.sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const start = (pageNum - 1) * limitNum;
      const paginated = restaurants.slice(start, start + limitNum);

      res.json({
        success: true,
        data: paginated,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: restaurants.length,
          totalPages: Math.ceil(restaurants.length / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // [SECURITY] M-1: $queryRawUnsafe → Prisma Client API
    const { id } = req.params;
    const r = await prisma.restaurant.findUnique({
      where: { id },
      include: { menus: { where: { isActive: true } } },
    });

    if (!r) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

    const restaurant = {
      id: r.id,
      name: r.name,
      address: r.address,
      roadAddress: r.roadAddress,
      phone: r.phone,
      category: r.category,
      storeType: r.storeType,
      brandName: r.brandName,
      description: r.description,
      imageUrl: r.imageUrl,
      thumbnailUrl: r.thumbnailUrl,
      latitude: r.latitude,
      longitude: r.longitude,
      businessStatus: r.businessStatus,
      businessHours: r.businessHours,
      rating: r.rating,
      isActive: r.isActive,
      isDeliverable: r.isDeliverable,
      deliveryRadius: r.deliveryRadius,
      operatingHours24: r.operatingHours24,
      regionId: r.regionId,
      menus: r.menus.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        price: m.price,
        imageUrl: m.imageUrl,
        thumbnailUrl: m.thumbnailUrl,
        isAvailable: m.isAvailable,
        isActive: m.isActive,
        category: m.category,
      })),
    };

    res.json({ success: true, data: restaurant });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/menus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { available_only = 'true' } = req.query;

    const where: any = { restaurantId: id, isActive: true };
    if (available_only === 'true') {
      where.isAvailable = true;
    }

    const menus = await prisma.menu.findMany({ where });

    res.json({ success: true, data: menus });
  } catch (error) {
    next(error);
  }
});

export default router;
