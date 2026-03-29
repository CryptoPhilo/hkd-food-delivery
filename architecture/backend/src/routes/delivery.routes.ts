import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { deliveryFeeService } from '../services/DeliveryFeeService';

const router = Router();
const prisma = new PrismaClient();

router.get('/fee', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurant_id, lat, lng } = req.query;

    if (!restaurant_id || !lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'restaurant_id, lat, lng are required',
      });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurant_id as string },
    });

    if (!restaurant) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

    const result = deliveryFeeService.calculateWithCoordinates(
      restaurant.latitude,
      restaurant.longitude,
      parseFloat(lat as string),
      parseFloat(lng as string)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/estimate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurant_id, lat, lng } = req.query;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurant_id as string },
    });

    if (!restaurant) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

    const result = deliveryFeeService.calculateWithCoordinates(
      restaurant.latitude,
      restaurant.longitude,
      parseFloat(lat as string),
      parseFloat(lng as string)
    );

    res.json({
      success: true,
      data: {
        estimatedPickupTime: result.estimatedPickupTime,
        estimatedDeliveryTime: result.estimatedDeliveryTime,
        totalTime: result.totalEstimatedTime,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
