import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { orderService } from '../services/OrderService';
import { webhookRateLimit } from '../middleware/security.middleware';
import { auditLogger, verifyPortOneWebhookSignature } from '../utils/security.utils';
import { validateSmsWebhook } from '../middleware/validation.middleware';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

router.post('/payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imp_uid, merchant_uid, status, amount } = req.body;

    // 웹훅 서명 검증 (프로덕션 필수)
    const signature = req.headers['webhook-signature'] as string;
    if (process.env.NODE_ENV === 'production' && process.env.PORTONE_WEBHOOK_SECRET) {
      const rawBody = JSON.stringify(req.body);
      const isValid = verifyPortOneWebhookSignature(rawBody, signature, process.env.PORTONE_WEBHOOK_SECRET!);

      if (!isValid) {
        auditLogger.logSecurityEvent({
          type: 'suspicious_input',
          ip: req.ip,
          details: { reason: 'invalid_webhook_signature', merchant_uid },
        });
        return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      }
    }

    auditLogger.log({
      action: 'WEBHOOK_PAYMENT_RECEIVED',
      resource: 'webhook',
      resourceId: imp_uid,
      details: { status, amount, merchant_uid },
    });

    logger.info('결제 웹훅 수신', { status, amount, merchant_uid });

    // =============================================
    // 결제 상태에 따라 주문 상태 자동 업데이트
    // =============================================
    if (merchant_uid) {
      // merchant_uid = 주문 ID (orderNumber)로 주문 조회
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { orderNumber: merchant_uid },
            { id: merchant_uid },
          ],
        },
      });

      if (order) {
        if (status === 'paid') {
          // 결제 성공 → 주문 확인 대기 상태로 변경
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'completed',
              customerPaymentId: imp_uid,
              customerPaidAt: new Date(),
              status: 'pending_confirmation',
            },
          });
          logger.info('결제 완료 → 주문 확인 대기', { orderId: order.id, imp_uid });

          // TODO: FCM 연동 후 관리자/식당에 푸시 알림 발송
          logger.info('관리자 알림 필요: 새 주문 접수', { orderNumber: order.orderNumber });

        } else if (status === 'cancelled' || status === 'failed') {
          // 결제 실패/취소 → 주문 상태 업데이트
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: status === 'cancelled' ? 'refunded' : 'failed',
              status: 'cancelled',
            },
          });
          logger.info(`결제 ${status} → 주문 취소`, { orderId: order.id });
        }
      } else {
        logger.warn('웹훅: 해당 주문을 찾을 수 없음', { merchant_uid });
      }
    }

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
