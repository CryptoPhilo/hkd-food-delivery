import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { jwtService } from '../services/JWTTokenService';
import { smsService } from '../services/SMSService';

const router = Router();
const prisma = new PrismaClient();

router.post('/phone/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.setting.upsert({
      where: { key: `verify_${phone}` },
      update: { value: verificationCode },
      create: { key: `verify_${phone}`, value: verificationCode, type: 'general' },
    });

    await smsService.sendSMS({
      to: phone,
      message: `[한경배달] 인증번호: ${verificationCode}\n3분 이내 입력해주세요.`,
    });

    res.json({
      success: true,
      message: '인증번호가 전송되었습니다',
      expires_in: 180,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/phone/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, code } = req.body;

    const setting = await prisma.setting.findFirst({
      where: { key: `verify_${phone}` },
    });

    if (!setting || setting.value !== code) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await prisma.user.create({
        data: { phone, isActive: true },
      });
    }

    const accessToken = jwtService.generateAccessToken(user.id, user.phone);
    const refreshToken = jwtService.generateRefreshToken(user.id, user.phone);

    await prisma.setting.delete({ where: { id: setting.id } }).catch(() => {});

    res.json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
