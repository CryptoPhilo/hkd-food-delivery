import { Router, Request, Response, NextFunction } from 'express';
import { businessHoursService } from '../services/BusinessHoursService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/business-hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await businessHoursService.getBusinessStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, any> = {};
    settings.forEach((s: any) => {
      result[s.key] = JSON.parse(s.value);
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/platform-hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platformHours = await prisma.setting.findUnique({
      where: { key: 'platform_hours' },
    });

    if (platformHours) {
      res.json({
        success: true,
        data: JSON.parse(platformHours.value),
      });
    } else {
      res.json({
        success: true,
        data: {
          openTime: '09:00',
          closeTime: '22:00',
          isActive: true,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/platform-hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { openTime, closeTime, isActive } = req.body;

    const value = JSON.stringify({ openTime, closeTime, isActive });

    const setting = await prisma.setting.upsert({
      where: { key: 'platform_hours' },
      update: { value, type: 'json' },
      create: { key: 'platform_hours', value, type: 'json', description: '배달 플랫폼 운영 시간' },
    });

    res.json({
      success: true,
      data: { openTime, closeTime, isActive },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/delivery-fee', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deliveryFee = await prisma.setting.findUnique({
      where: { key: 'delivery_fee' },
    });

    if (deliveryFee) {
      res.json({
        success: true,
        data: JSON.parse(deliveryFee.value),
      });
    } else {
      res.json({
        success: true,
        data: {
          baseFee: 3000,
          perKmFee: 500,
          maxDistance: 5.0,
          freeDeliveryThreshold: 30000,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/delivery-fee', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { baseFee, perKmFee, maxDistance, freeDeliveryThreshold } = req.body;

    const value = JSON.stringify({ baseFee, perKmFee, maxDistance, freeDeliveryThreshold });

    const setting = await prisma.setting.upsert({
      where: { key: 'delivery_fee' },
      update: { value, type: 'json' },
      create: { key: 'delivery_fee', value, type: 'json', description: '배달비 설정' },
    });

    res.json({
      success: true,
      data: { baseFee, perKmFee, maxDistance, freeDeliveryThreshold },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
