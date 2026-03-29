import { Router, Request, Response, NextFunction } from 'express';
import { settlementService } from '../services/SettlementService';

const router = Router({ mergeParams: true });

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId } = req.params;

    const result = await settlementService.getDriverSettlements(driverId);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    if (error.message.includes('찾을 수 없습니다')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId } = req.params;

    const result = await settlementService.getCurrentSettlement(driverId);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    if (error.message.includes('찾을 수 없습니다')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

router.get('/:settlementId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId, settlementId } = req.params;

    const settlement = await settlementService.getDriverSettlementDetail(driverId, settlementId);

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

export default router;
