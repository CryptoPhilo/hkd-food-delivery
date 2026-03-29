import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/OrderService';

const router = Router();

router.post('/payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imp_uid, merchant_uid, status, amount } = req.body;
    
    console.log(`Payment webhook received: ${status}, amount: ${amount}`);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Payment webhook error:', error);
    res.status(200).json({ success: true });
  }
});

router.post('/sms', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, content, type } = req.body;

    console.log(`SMS received from ${from}: ${content}`);

    if (type === 'SMS' && content === '') {
      const { smsService } = await import('../services/SMSService');
      const { jwtService } = await import('../services/JWTTokenService');

      const openUrl = `${process.env.FRONTEND_URL}/restaurants`;
      const closedUrl = `${process.env.FRONTEND_URL}/closed`;

      const { businessHoursService } = await import('../services/BusinessHoursService');
      const isOpen = await businessHoursService.isCurrentlyOpen();

      const targetUrl = isOpen ? openUrl : closedUrl;

      await smsService.sendSMS({
        to: from,
        message: `[한경배달] 주문을 시작하려면 아래 링크를 클릭하세요.\n${targetUrl}`,
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('SMS webhook error:', error);
    res.status(200).send('OK');
  }
});

router.post('/naver-sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurants } = req.body;

    const { restaurantSyncService } = await import('../services/RestaurantSyncService');
    
    for (const restaurant of restaurants) {
      await restaurantSyncService.syncRestaurant(restaurant);
    }

    res.json({
      success: true,
      synced: restaurants.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
