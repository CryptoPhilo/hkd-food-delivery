import { Router, Request, Response, NextFunction } from 'express';
import { ageVerificationService } from '../services/AgeVerificationService';
import { jwtService } from '../services/JWTTokenService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: string;
    phone: string;
  };
}

const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: '인증이 필요합니다',
    });
  }

  const token = authHeader.substring(7);
  const payload = jwtService.verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      error: '유효하지 않은 토큰입니다',
    });
  }

  req.user = {
    id: payload.userId,
    phone: payload.phone,
  };

  next();
};

router.post('/request', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userPhone = req.user?.phone;

    if (!userId || !userPhone) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다',
      });
    }

    const result = await ageVerificationService.requestVerification({
      userId,
      phoneNumber: userPhone,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/verify', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다',
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        error: '인증번호가 필요합니다',
      });
    }

    const result = await ageVerificationService.verify({
      userId,
      code,
    });

    res.json(result);
  } catch (error: any) {
    if (error.message.includes('인증번호') || error.message.includes('만료')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

router.get('/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다',
      });
    }

    const status = await ageVerificationService.getStatus(userId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
