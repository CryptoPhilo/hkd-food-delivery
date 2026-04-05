import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { jwtService } from '../services/JWTTokenService';
import { smsService } from '../services/SMSService';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// Refresh Token 쿠키 설정
// ============================================
const REFRESH_TOKEN_COOKIE = 'hkd_refresh_token';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7일 (ms)

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: '/api/v1/auth', // auth 엔드포인트에서만 전송
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
}

// ============================================
// POST /api/v1/auth/phone/request — SMS 인증번호 요청
// ============================================
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

// ============================================
// POST /api/v1/auth/phone/verify — SMS 인증번호 확인 + JWT 발급
// ============================================
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

    // Token Pair 생성 (Refresh Token은 DB에 자동 저장됨)
    const tokens = await jwtService.generateTokenPair(user.id, user.phone, 'user');

    await prisma.setting.delete({ where: { id: setting.id } }).catch(() => {});

    // Refresh Token을 httpOnly 쿠키로 설정
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.json({
      success: true,
      access_token: tokens.accessToken,
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

// ============================================
// POST /api/v1/auth/refresh — Access Token 갱신 (Refresh Token Rotation)
// ============================================
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 쿠키 우선, body fallback (하위 호환)
    const refresh_token = req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body.refresh_token;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    const tokens = await jwtService.refreshAccessToken(refresh_token);

    if (!tokens) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        error: '유효하지 않거나 만료된 리프레시 토큰입니다. 다시 로그인해주세요.',
      });
    }

    // 새 Refresh Token을 httpOnly 쿠키로 설정 (Rotation)
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.json({
      success: true,
      access_token: tokens.accessToken,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/v1/auth/logout — 로그아웃 (Refresh Token 무효화)
// ============================================
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 쿠키 우선, body fallback (하위 호환)
    const refresh_token = req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body.refresh_token;

    if (refresh_token) {
      await jwtService.revokeRefreshToken(refresh_token);
    }

    clearRefreshTokenCookie(res);

    res.json({
      success: true,
      message: '로그아웃 되었습니다',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
