import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// [SECURITY] H-4: 기본 폴백 제거 — JWT_SECRET 미설정 시 서버 기동 실패
if (!process.env.JWT_SECRET) {
  throw new Error(
    '[SECURITY] JWT_SECRET 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.',
  );
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error(
    '[SECURITY] JWT_REFRESH_SECRET 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.',
  );
}

const JWT_ACCESS_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export type UserRole = 'user' | 'driver' | 'admin';

export interface TokenPayload {
  userId: string;
  phone: string;
  type: 'access' | 'refresh' | 'confirm';
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTService {
  private static instance: JWTService;

  static getInstance(): JWTService {
    if (!JWTService.instance) {
      JWTService.instance = new JWTService();
    }
    return JWTService.instance;
  }

  /**
   * Access Token 생성 (JWT_ACCESS_SECRET 사용)
   */
  generateAccessToken(userId: string, phone: string, role: UserRole = 'user'): string {
    const payload: TokenPayload = { userId, phone, type: 'access', role };
    return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  /**
   * Refresh Token 생성 (JWT_REFRESH_SECRET 사용)
   */
  generateRefreshToken(userId: string, phone: string, role: UserRole = 'user'): string {
    const payload: TokenPayload = { userId, phone, type: 'refresh', role };
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  }

  /**
   * Token Pair 생성 + Refresh Token DB 저장
   */
  async generateTokenPair(
    userId: string,
    phone: string,
    role: UserRole = 'user',
  ): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(userId, phone, role);
    const refreshToken = this.generateRefreshToken(userId, phone, role);

    // Refresh Token을 DB에 저장 (Revocation 지원)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        userType: role,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * 주문 확정 토큰 생성 (기존 유지)
   */
  generateConfirmToken(orderId: string, phone: string): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const payload = {
      orderId,
      phone,
      type: 'confirm',
      exp: Math.floor(expiresAt.getTime() / 1000),
    };
    const token = jwt.sign(payload, JWT_ACCESS_SECRET);
    return { token, expiresAt };
  }

  /**
   * Access Token 검증 (JWT_ACCESS_SECRET 사용)
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh Token 검증 (JWT_REFRESH_SECRET 사용)
   */
  verifyRefreshToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
      if (decoded.type !== 'refresh') return null;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * 주문 확정 토큰 검증 (기존 유지)
   */
  verifyConfirmToken(token: string): { orderId: string; phone: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as {
        orderId: string;
        phone: string;
        type: string;
      };
      if (decoded.type !== 'confirm') return null;
      return { orderId: decoded.orderId, phone: decoded.phone };
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh Token Rotation으로 새 토큰 쌍 발급
   * - 기존 Refresh Token 즉시 무효화
   * - 재사용 탐지 시 해당 사용자의 모든 토큰 무효화
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
    // 1. JWT 서명 검증
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) return null;

    // 2. DB에서 토큰 존재 여부 확인
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!stored) return null;

    // 3. 이미 사용(무효화)된 토큰이 재사용된 경우 → 탈취 의심
    if (stored.revokedAt) {
      logger.warn(
        `[SECURITY] Refresh token reuse detected for user ${stored.userId}. Revoking all tokens.`,
      );
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    // 4. 만료 확인
    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    // 5. 기존 Refresh Token 즉시 무효화 (Rotation)
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // 6. 새 토큰 쌍 발급
    const role = (decoded.role || stored.userType || 'user') as UserRole;
    return this.generateTokenPair(decoded.userId, decoded.phone, role);
  }

  /**
   * 로그아웃 — 해당 Refresh Token 무효화
   */
  async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    try {
      await prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 특정 사용자의 모든 Refresh Token 무효화 (강제 로그아웃)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * 토큰 디코딩 (서명 미검증)
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch (error) {
      return null;
    }
  }
}

export const jwtService = JWTService.getInstance();
