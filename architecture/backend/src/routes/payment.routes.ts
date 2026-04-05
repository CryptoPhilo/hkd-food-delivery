import { Router, Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/PaymentService';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/payments/verify
 * 클라이언트에서 PortOne V2 결제 완료 후 서버 사이드 검증
 */
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId, amount } = req.body;

    if (!paymentId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'paymentId와 amount는 필수입니다',
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 결제 금액입니다',
      });
    }

    const result = await paymentService.verifyPayment({ paymentId, amount });

    if (result.success) {
      return res.json({
        success: true,
        data: {
          paymentId: result.paymentId,
          status: result.status,
          amount: result.amount,
        },
      });
    }

    return res.status(400).json({
      success: false,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('결제 검증 라우트 오류', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/v1/payments/cancel
 * 결제 취소 (관리자 또는 시스템)
 */
router.post('/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId, amount, reason } = req.body;

    if (!paymentId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'paymentId와 amount는 필수입니다',
      });
    }

    const result = await paymentService.cancelPayment(paymentId, amount, reason);

    if (result.success) {
      return res.json({
        success: true,
        data: {
          cancelId: result.cancelId,
          canceledAmount: result.canceledAmount,
        },
      });
    }

    return res.status(400).json({
      success: false,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('결제 취소 라우트 오류', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/v1/payments/:paymentId/status
 * 결제 상태 조회
 */
router.get('/:paymentId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;

    const status = await paymentService.getPaymentStatus(paymentId);

    if (status) {
      return res.json({
        success: true,
        data: { paymentId, status },
      });
    }

    return res.status(404).json({
      success: false,
      error: '결제 정보를 찾을 수 없습니다',
    });
  } catch (error: any) {
    logger.error('결제 상태 조회 라우트 오류', { error: error.message });
    next(error);
  }
});

export default router;
