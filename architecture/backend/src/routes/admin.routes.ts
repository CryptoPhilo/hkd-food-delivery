import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/OrderService';
import { restaurantSyncService } from '../services/RestaurantSyncService';
import { diningCodeScraperService } from '../services/DiningCodeScraperService';
import { storeService } from '../services/StoreService';
import { PrismaClient } from '@prisma/client';
import { OrderStatusEnum } from '../types/prisma';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// Middleware
// ============================================
function validateSearchQuery(req: Request, res: Response, next: NextFunction) {
  next();
}

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      pending,
      pendingConfirmation,
      orderConfirmed,
      pickedUp,
      delivering,
      completed,
      recentOrders,
    ] = await Promise.all([
      prisma.order.count({ where: { status: OrderStatusEnum.PENDING } }),
      prisma.order.count({ where: { status: OrderStatusEnum.PENDING_CONFIRMATION } }),
      prisma.order.count({ where: { status: OrderStatusEnum.ORDER_CONFIRMED } }),
      prisma.order.count({ where: { status: OrderStatusEnum.PICKED_UP } }),
      prisma.order.count({ where: { status: OrderStatusEnum.DELIVERING } }),
      prisma.order.count({ where: { status: OrderStatusEnum.COMPLETED, createdAt: { gte: today } } }),
      prisma.order.findMany({
        where: { createdAt: { gte: today } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          restaurant: true,
        },
      }),
    ]);

    const stats = {
      pending,
      pending_confirmation: pendingConfirmation,
      order_confirmed: orderConfirmed,
      picked_up: pickedUp,
      delivering,
      completed,
    };

    const recentOrdersData = recentOrders.map((order: any) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      restaurantName: order.restaurant.name,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt.toISOString(),
    }));

    res.json({
      success: true,
      stats,
      recentOrders: recentOrdersData,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/orders', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    let whereClause: any = {};

    // Order에는 regionId가 없으므로 restaurant.regionId로 필터
    const regionId = req.adminUser?.regionId;
    if (regionId) {
      whereClause.restaurant = { regionId };
    }

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // [SECURITY] user 객체에서 민감 필드 제외 (CRITICAL-03)
    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, phone: true, name: true, isActive: true, createdAt: true, updatedAt: true } },
        restaurant: true,
        items: true,
      },
    });

    res.json({
      success: true,
      orders: orders,
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 주문 상태 전환 (어드민 수동)
// ========================================
const STATUS_TRANSITIONS: Record<string, { next: string; requiredFields: string[]; fieldLabels: Record<string, string> }> = {
  pending: {
    next: 'order_confirmed',
    requiredFields: ['driverId'],
    fieldLabels: { driverId: '배달원 ID' },
  },
  order_confirmed: {
    next: 'picked_up',
    requiredFields: ['estimatedPickupTime', 'restaurantPaidAmount'],
    fieldLabels: { estimatedPickupTime: '픽업 예정 시간', restaurantPaidAmount: '식당 결제 금액' },
  },
  picked_up: {
    next: 'delivering',
    requiredFields: ['pickupConfirmation'],
    fieldLabels: { pickupConfirmation: '픽업 완료 확인 (true)' },
  },
  delivering: {
    next: 'completed',
    requiredFields: ['deliveryConfirmation'],
    fieldLabels: { deliveryConfirmation: '배달 완료 확인 (true)' },
  },
};

router.put('/orders/:orderId/advance', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const regionId = req.adminUser?.regionId;

    let whereClause: any = { id: orderId };
    if (regionId) {
      whereClause.restaurant = { regionId };
    }

    const order = await prisma.order.findFirst({
      where: whereClause,
    });

    if (!order) {
      return res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다' });
    }

    const transition = STATUS_TRANSITIONS[order.status];
    if (!transition) {
      return res.status(400).json({ success: false, error: `현재 상태(${order.status})에서는 다음 단계로 진행할 수 없습니다` });
    }

    // 필수 필드 검증
    const missingFields: string[] = [];
    for (const field of transition.requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missingFields.push(transition.fieldLabels[field] || field);
      }
    }
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `필수 정보가 누락되었습니다: ${missingFields.join(', ')}`,
        requiredFields: transition.requiredFields,
        fieldLabels: transition.fieldLabels,
      });
    }

    // 상태별 업데이트 데이터 구성
    const updateData: any = {
      status: transition.next,
      updatedAt: new Date(),
    };

    switch (order.status) {
      case 'pending':
        // 배달원 배정
        const driver = await prisma.driver.findUnique({ where: { id: req.body.driverId } });
        if (!driver) {
          return res.status(400).json({ success: false, error: '존재하지 않는 배달원입니다' });
        }
        updateData.driverId = req.body.driverId;
        updateData.confirmedAt = new Date();
        break;
      case 'order_confirmed':
        // 픽업 시간 설정 및 식당 결제
        updateData.estimatedPickupTime = new Date(req.body.estimatedPickupTime);
        updateData.restaurantPaidAmount = parseInt(req.body.restaurantPaidAmount);
        updateData.restaurantPaidAt = new Date();
        updateData.pickedUpAt = new Date();
        break;
      case 'picked_up':
        // 배달 시작
        updateData.pickedUpAt = new Date();
        break;
      case 'delivering':
        // 배달 완료
        updateData.deliveredAt = new Date();
        break;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { user: { select: { id: true, phone: true, name: true, isActive: true, createdAt: true, updatedAt: true } }, restaurant: true, items: true },
    });

    // SMS 제거 — 고객 알림은 웹 주문조회(polling)로 대체
    // 복수 식당 배달 그룹 상태 동기화 로직은 유지
    const statusSyncAsync = async () => {
      try {
        if (transition.next === 'picked_up' && (updated as any).deliveryGroupId) {
          await (prisma.order.updateMany as any)({
            where: {
              deliveryGroupId: (updated as any).deliveryGroupId,
              id: { not: orderId },
              status: { in: ['order_confirmed'] },
            },
            data: { status: 'picked_up', updatedAt: new Date() },
          });
        }
        if (transition.next === 'delivering' && (updated as any).deliveryGroupId) {
          await (prisma.order.updateMany as any)({
            where: {
              deliveryGroupId: (updated as any).deliveryGroupId,
              id: { not: orderId },
              status: { in: ['picked_up'] },
            },
            data: { status: 'delivering', updatedAt: new Date() },
          });
        }
      } catch (syncError) {
        logger.error('[Admin] 배달 그룹 상태 동기화 실패', { orderId, error: syncError });
      }
    };
    statusSyncAsync();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// 주문 취소 (사유 필수)
router.put('/orders/:orderId/cancel', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const { cancelReason } = req.body;
    const regionId = req.adminUser?.regionId;

    if (!cancelReason || cancelReason.trim() === '') {
      return res.status(400).json({ success: false, error: '취소 사유를 입력해주세요' });
    }

    let whereClause: any = { id: orderId };
    if (regionId) {
      whereClause.restaurant = { regionId };
    }

    const order = await prisma.order.findFirst({
      where: whereClause,
    });

    if (!order) {
      return res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다' });
    }

    if (order.status === 'delivered' || order.status === 'cancelled') {
      return res.status(400).json({ success: false, error: `이미 ${order.status === 'delivered' ? '배달 완료' : '취소'}된 주문입니다` });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        cancelReason: cancelReason.trim(),
        cancelledAt: new Date(),
        paymentStatus: 'refunded',
        updatedAt: new Date(),
      },
      include: { user: { select: { id: true, phone: true, name: true, isActive: true, createdAt: true, updatedAt: true } }, restaurant: true, items: true },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// 주문 삭제 (사유 필수)
router.delete('/orders/:orderId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const regionId = req.adminUser?.regionId;

    const { reason } = req.body || {};
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, error: '삭제 사유를 입력해주세요' });
    }

    let whereClause: any = { id: orderId };
    if (regionId) {
      whereClause.restaurant = { regionId };
    }

    const order = await prisma.order.findFirst({
      where: whereClause,
    });

    if (!order) {
      return res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다' });
    }

    // 주문 항목 먼저 삭제
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });

    logger.info(`Order ${orderId} deleted by admin. Reason: ${reason.trim()}`);
    res.json({ success: true, message: '주문이 삭제되었습니다' });
  } catch (error) {
    next(error);
  }
});

// 해당 지역 배달원 목록 (주문에서 배달원 배정용)
router.get('/orders/available-drivers', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Note: Drivers are not region-specific in current schema, returning all drivers
    const drivers = await prisma.driver.findMany({
      select: { id: true, name: true, phone: true, isOnDuty: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: drivers });
  } catch (error) {
    next(error);
  }
});

router.get('/restaurants', validateSearchQuery, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { isActive, isDeliverable, search } = req.query;
    let whereClause: any = {};

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }
    if (isDeliverable !== undefined) {
      whereClause.isDeliverable = isDeliverable === 'true';
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: String(search) } },
        { address: { contains: String(search) } },
      ];
    }

    const restaurants = await prisma.restaurant.findMany({
      where: whereClause,
      include: {
        menus: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: restaurants,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/restaurants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      address,
      roadAddress,
      latitude,
      longitude,
      category,
      phone,
      description,
      isActive,
      isDeliverable,
      deliveryRadius,
      rating,
      businessHours,
      menus,
    } = req.body;

    if (!name || !address) {
      return res.status(400).json({
        success: false,
        error: '식당 이름과 주소는 필수입니다',
      });
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        address,
        roadAddress: roadAddress || null,
        latitude: latitude || 0,
        longitude: longitude || 0,
        category: category || null,
        phone: phone || null,
        description: description || null,
        isActive: isActive ?? true,
        isDeliverable: isDeliverable ?? true,
        deliveryRadius: deliveryRadius || 3,
        rating: rating || 0,
        businessHours: businessHours || null,
        menus: menus && menus.length > 0 ? {
          create: menus.map((m: any) => ({
            name: m.name,
            description: m.description || null,
            price: m.price || 0,
            isAvailable: m.isAvailable ?? true,
            isActive: true,
          })),
        } : undefined,
      },
      include: {
        menus: true,
      },
    });

    res.json({
      success: true,
      data: restaurant,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/restaurants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.menu.deleteMany({
      where: { restaurantId: id },
    });

    await prisma.restaurant.delete({
      where: { id },
    });

    res.json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/restaurants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, address, roadAddress, phone, category, description, latitude, longitude, imageUrl, thumbnailUrl, businessHours, isActive, isDeliverable, isRecommended, deliveryRadius, minimumOrderAmount } = req.body;

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(roadAddress !== undefined && { roadAddress }),
        ...(phone !== undefined && { phone }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(businessHours !== undefined && { businessHours }),
        ...(isActive !== undefined && { isActive }),
        ...(isDeliverable !== undefined && { isDeliverable }),
        ...(isRecommended !== undefined && { isRecommended }),
        ...(deliveryRadius !== undefined && { deliveryRadius }),
        ...(minimumOrderAmount !== undefined && { minimumOrderAmount }),
      },
    });

    res.json({
      success: true,
      data: restaurant,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/menus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId, name, description, price, isAvailable, imageUrl } = req.body;

    const menu = await prisma.menu.create({
      data: {
        restaurantId,
        name,
        description,
        price,
        imageUrl,
        isAvailable: isAvailable ?? true,
        isActive: true,
      },
    });

    res.json({
      success: true,
      data: menu,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/menus/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, price, isAvailable, imageUrl, thumbnailUrl } = req.body;

    const menu = await prisma.menu.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price && { price }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
      },
    });

    res.json({
      success: true,
      data: menu,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/menus/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.menu.delete({
      where: { id },
    });

    res.json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/import-mock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const dataFilePath = path.join(__dirname, '../../data/jeju-hangyeong-restaurants.json');
    
    if (!fs.existsSync(dataFilePath)) {
      return res.status(404).json({
        success: false,
        error: 'Mock 데이터 파일을 찾을 수 없습니다',
      });
    }

    const rawData = fs.readFileSync(dataFilePath, 'utf-8');
    const data = JSON.parse(rawData);

    let importCount = 0;
    let skipCount = 0;

    for (const restaurant of data.restaurants) {
      const existing = await prisma.restaurant.findFirst({
        where: { name: restaurant.name },
      });

      if (existing) {
        skipCount++;
        continue;
      }

      await prisma.restaurant.create({
        data: {
          name: restaurant.name,
          address: restaurant.address,
          roadAddress: restaurant.road_address,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          category: restaurant.category,
          phone: restaurant.phone,
          description: restaurant.description || null,
          isActive: restaurant.is_active,
          isDeliverable: restaurant.is_deliverable,
          rating: restaurant.rating,
          businessHours: restaurant.business_hours,
          deliveryRadius: 3,
          menus: {
            create: restaurant.menus.map((m: any) => ({
              name: m.name,
              description: m.description || null,
              price: m.price,
              isAvailable: true,
              isActive: true,
            })),
          },
        },
      });

      importCount++;
    }

    res.json({
      success: true,
      message: `${importCount}개 식당 데이터 import 완료 (${skipCount}개 건너뜀)`,
      importCount,
      skipCount,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/scrape', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { area, maxResults = 20 } = req.body;

    if (!area) {
      return res.status(400).json({
        success: false,
        error: '지역명을 입력해주세요',
      });
    }

    const restaurants = await diningCodeScraperService.scrapeRestaurants(area, maxResults);

    if (!restaurants || restaurants.length === 0) {
      return res.json({
        success: true,
        message: '검색 결과가 없습니다',
        syncedCount: 0,
      });
    }

    let syncedCount = 0;

    for (const place of restaurants) {
      try {
        await restaurantSyncService.syncRestaurant({
          naverPlaceId: place.id,
          name: place.name,
          address: place.address,
          roadAddress: place.roadAddress,
          latitude: place.latitude,
          longitude: place.longitude,
          category: place.category,
          phone: place.phone,
          isOpen: true,
        });

        if (place.menu.length > 0) {
          const restaurant = await prisma.restaurant.findUnique({
            where: { naverPlaceId: place.id },
          });

          if (restaurant) {
            for (const menuItem of place.menu) {
              try {
                const safeId = `${restaurant.id}_${menuItem.name}`
                  .replace(/[^a-zA-Z0-9가-힣_-]/g, '_')
                  .slice(0, 50);
                
                await prisma.menu.upsert({
                  where: {
                    id: safeId,
                  },
                  create: {
                    id: safeId,
                    restaurantId: restaurant.id,
                    name: menuItem.name,
                    price: menuItem.price || 0,
                    imageUrl: menuItem.imageUrl || null,
                    isAvailable: true,
                    isActive: true,
                  },
                  update: {
                    price: menuItem.price || 0,
                    imageUrl: menuItem.imageUrl || null,
                  },
                });
              } catch (menuError) {
                console.error(`Failed to sync menu ${menuItem.name}:`, menuError);
              }
            }
          }
        }

        syncedCount++;
      } catch (error) {
        console.error(`Failed to sync restaurant ${place.name}:`, error);
      }
    }

    res.json({
      success: true,
      message: `${area}에서 ${syncedCount}개 식당 데이터 수집 완료`,
      syncedCount,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.setting.findMany();

    const settingsMap: Record<string, any> = {};
    settings.forEach((s: any) => {
      settingsMap[s.key] = JSON.parse(s.value);
    });

    res.json({
      success: true,
      data: settingsMap,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, value, type } = req.body;

    if (!key || !value) {
      return res.status(400).json({
        success: false,
        error: 'key와 value는 필수입니다',
      });
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(value),
        type: type || 'general',
      },
      create: {
        key,
        value: JSON.stringify(value),
        type: type || 'general',
      },
    });

    res.json({
      success: true,
      data: setting,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/menus/:menuId/image', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { menuId } = req.params;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: '이미지 URL은 필수입니다',
      });
    }

    const menu = await prisma.menu.update({
      where: { id: menuId },
      data: { imageUrl },
    });

    res.json({
      success: true,
      data: menu,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/restaurants/:restaurantId/menus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const menus = await prisma.menu.findMany({
      where: { restaurantId },
    });

    res.json({
      success: true,
      data: menus,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/stores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const store = await storeService.createStore(req.body);

    res.status(201).json({
      success: true,
      data: store,
    });
  } catch (error: any) {
    if (error.message.includes('필수') || error.message.includes('좌표')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

router.get('/stores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeType, isActive } = req.query;

    const filters: any = {};
    if (storeType) {
      filters.storeType = String(storeType);
    }
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    const stores = await storeService.getStores(filters);

    res.json({
      success: true,
      data: stores,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stores/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const store = await storeService.getStoreById(id);

    res.json({
      success: true,
      data: store,
    });
  } catch (error: any) {
    if (error.message === 'Store not found') {
      return res.status(404).json({
        success: false,
        error: '스토어를 찾을 수 없습니다',
      });
    }
    next(error);
  }
});

router.put('/stores/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const store = await storeService.updateStore(id, req.body);

    res.json({
      success: true,
      data: store,
    });
  } catch (error: any) {
    if (error.message === 'Store not found') {
      return res.status(404).json({
        success: false,
        error: '스토어를 찾을 수 없습니다',
      });
    }
    if (error.message.includes('좌표')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

router.delete('/stores/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await storeService.deleteStore(id);

    res.json({
      success: true,
    });
  } catch (error: any) {
    if (error.message === 'Store not found') {
      return res.status(404).json({
        success: false,
        error: '스토어를 찾을 수 없습니다',
      });
    }
    next(error);
  }
});

router.post('/stores/:storeId/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;

    const product = await storeService.createProduct({
      ...req.body,
      restaurantId: storeId,
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    if (error.message === 'Store not found') {
      return res.status(404).json({
        success: false,
        error: '스토어를 찾을 수 없습니다',
      });
    }
    if (error.message.includes('필수') || error.message.includes('이상이어야')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

router.get('/stores/:storeId/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const { category, requiresAgeVerification, availableOnly } = req.query;

    const filters: any = {};
    if (category) {
      filters.category = String(category);
    }
    if (requiresAgeVerification !== undefined) {
      filters.requiresAgeVerification = requiresAgeVerification === 'true';
    }
    if (availableOnly !== undefined) {
      filters.availableOnly = availableOnly === 'true';
    }

    const products = await storeService.getProducts(storeId, filters);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const product = await storeService.updateProduct(id, req.body);

    res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    if (error.message === 'Product not found') {
      return res.status(404).json({
        success: false,
        error: '상품을 찾을 수 없습니다',
      });
    }
    if (error.message.includes('이상이어야')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

router.patch('/products/:id/stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { quantity, operation } = req.body;

    if (!quantity && quantity !== 0 || !operation) {
      return res.status(400).json({
        success: false,
        error: '수량과 연산 방식은 필수입니다',
      });
    }

    const product = await storeService.updateStock(id, {
      quantity: Number(quantity),
      operation: operation as 'add' | 'subtract' | 'set',
    });

    res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    if (error.message === 'Product not found') {
      return res.status(404).json({
        success: false,
        error: '상품을 찾을 수 없습니다',
      });
    }
    if (error.message.includes('이상이어야') || error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

router.delete('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await storeService.deleteProduct(id);

    res.json({
      success: true,
    });
  } catch (error: any) {
    if (error.message === 'Product not found') {
      return res.status(404).json({
        success: false,
        error: '상품을 찾을 수 없습니다',
      });
    }
    next(error);
  }
});

export default router;
