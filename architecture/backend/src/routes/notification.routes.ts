import { Router, Request, Response } from 'express';

const router = Router();

// 알림 목록 조회
router.get('/', async (req: Request, res: Response) => {
  res.json({ success: true, data: [] });
});

export default router;
