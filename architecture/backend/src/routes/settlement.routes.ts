import { Router, Request, Response, NextFunction } from 'express';
import { settlementService } from '../services/SettlementService';

const router = Router();

router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, serviceFeeRate, taxRate } = req.body;

    if (!period) {
      return res.status(400).json({
        success: false,
        error: '정산 기간이 필요합니다'
      });
    }

    console.log('Generating settlement for period:', period);

    const config: any = {};
    if (serviceFeeRate !== undefined) config.serviceFeeRate = serviceFeeRate;
    if (taxRate !== undefined) config.taxRate = taxRate;

    const result = await settlementService.generateMonthlySettlement(
      period,
      config
    );

    console.log('Settlement generated:', result);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Settlement generation error:', error);
    if (error.message.includes('기간 형식')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, status, driverId, page, limit } = req.query;

    const result = await settlementService.getSettlements({
      period: period as string,
      status: status as string,
      driverId: driverId as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const settlement = await settlementService.getSettlementById(id);

    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: '정산을 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      data: settlement
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const adminId = 'admin';

    const settlement = await settlementService.approveSettlement(id, adminId, notes);

    res.json({
      success: true,
      message: '정산이 승인되었습니다',
      data: settlement
    });
  } catch (error: any) {
    if (error.message.includes('찾을 수 없습니다') || error.message.includes('승인할 수 있습니다')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

router.put('/:id/pay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { paidAmount, paidAt, notes } = req.body;

    if (!paidAmount || paidAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: '지급액이 필요합니다'
      });
    }

    const settlement = await settlementService.markAsPaid(
      id,
      paidAmount,
      paidAt ? new Date(paidAt) : new Date(),
      notes
    );

    res.json({
      success: true,
      message: '지급이 완료 처리되었습니다',
      data: settlement
    });
  } catch (error: any) {
    if (error.message.includes('찾을 수 없습니다') || error.message.includes('지급 처리할 수 있습니다')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period } = req.query;

    const result = await settlementService.getSettlements({
      period: period as string
    });

    res.json({
      success: true,
      data: result.summary
    });
  } catch (error) {
    next(error);
  }
});

export default router;
