import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

interface TokenPayload {
  userId: string;
  phone: string;
  type: 'access' | 'refresh' | 'confirm';
}

export class JWTService {
  private static instance: JWTService;

  static getInstance(): JWTService {
    if (!JWTService.instance) {
      JWTService.instance = new JWTService();
    }
    return JWTService.instance;
  }

  generateAccessToken(userId: string, phone: string): string {
    const payload: TokenPayload = { userId, phone, type: 'access' };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  generateRefreshToken(userId: string, phone: string): string {
    const payload: TokenPayload = { userId, phone, type: 'refresh' };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  }

  generateConfirmToken(orderId: string, phone: string): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const payload = {
      orderId,
      phone,
      type: 'confirm',
      exp: Math.floor(expiresAt.getTime() / 1000),
    };
    const token = jwt.sign(payload, JWT_SECRET);
    return { token, expiresAt };
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  verifyConfirmToken(token: string): { orderId: string; phone: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
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

  refreshAccessToken(refreshToken: string): string | null {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as TokenPayload;
      if (decoded.type !== 'refresh') return null;
      return this.generateAccessToken(decoded.userId, decoded.phone);
    } catch (error) {
      return null;
    }
  }

  decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch (error) {
      return null;
    }
  }
}

export const jwtService = JWTService.getInstance();
