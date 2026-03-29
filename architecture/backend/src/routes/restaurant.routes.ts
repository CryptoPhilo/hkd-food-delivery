import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { deliveryFeeService } from '../services/DeliveryFeeService';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, category, page = '1', limit = '20' } = req.query;

    const whereClause: any = {
      isActive: true,
      isDeliverable: true,
      businessStatus: 'open',
    };

    let restaurants = await prisma.restaurant.findMany({
      where: whereClause,
      include: {
        menus: {
          where: { isAvailable: true, isActive: true },
        },
      },
    });

    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);

      restaurants = restaurants.map((r: any) => {
        const info = deliveryFeeService.calculateWithCoordinates(
          r.latitude, r.longitude, userLat, userLng
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
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: { menus: { where: { isActive: true } } },
    });

    if (!restaurant) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

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
