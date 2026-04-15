/**
 * 인증 및 권한 미들웨어
 * - JWT 토큰 검증
 * - 역할 기반 접근 제어 (RBAC)
 * - 관리자 인증
 * - 주문 소유권 검증
 */
import { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/JWTTokenService';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Request에 사용자 정보를 추가하기 위한 인터페이스 확장
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    phone: string;
    role: 'user' | 'driver' | 'admin';
  };
  adminUser?: {
    id: string;
    username: string;
    name: string;
    role: 'system_admin' | 'region_admin';
    regionId: string | null;
  };
}

/**
 * JWT 토큰 검증 미들웨어
 * Authorization: Bearer <token> 헤더에서 토큰을 추출하여 검증
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: '인증 토큰이 필요합니다',
      });
    }

    const decoded = jwtService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않거나 만료된 토큰입니다',
      });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: '올바른 접근 토큰이 아닙니다',
      });
    }

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: '비활성화된 계정입니다',
      });
    }

    req.user = {
      userId: decoded.userId,
      phone: decoded.phone,
      role: 'user',
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '인증 처리 중 오류가 발생했습니다',
    });
  }
};

/**
 * 관리자 인증 미들웨어
 * - JWT 기반 어드민 로그인 (X-Admin-Token 헤더)
 * - [SECURITY] X-Admin-Key 정적 키 인증 경로 제거 (CRITICAL-07)
 */
export const authenticateAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // [SECURITY] H-1: httpOnly 쿠키 우선, X-Admin-Token 헤더 폴백
    const adminToken = req.cookies?.admin_token || (req.headers['x-admin-token'] as string);
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: '관리자 인증이 필요합니다',
      });
    }

    const decoded = jwtService.verifyToken(adminToken);
    if (!decoded || !decoded.phone?.startsWith('admin:')) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않거나 만료된 관리자 토큰입니다',
      });
    }

    const adminId = decoded.phone.replace('admin:', '');
    const adminUser = await (prisma as any).adminUser.findUnique({
      where: { id: adminId },
    });

    if (!adminUser || !adminUser.isActive) {
      return res.status(403).json({
        success: false,
        error: '비활성화된 관리자 계정입니다',
      });
    }

    req.adminUser = {
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
      role: adminUser.role as 'system_admin' | 'region_admin',
      regionId: adminUser.regionId,
    };
    req.user = { userId: adminUser.id, phone: '', role: 'admin' };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '관리자 인증 처리 중 오류가 발생했습니다',
    });
  }
};

/**
 * 시스템 어드민 전용 미들웨어
 */
export const requireSystemAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.adminUser || req.adminUser.role !== 'system_admin') {
    return res.status(403).json({
      success: false,
      error: '시스템 관리자 권한이 필요합니다',
    });
  }
  next();
};

/**
 * 지역 접근 권한 미들웨어
 * system_admin은 모든 지역 접근 가능, region_admin은 자기 지역만
 */
export const requireRegionAccess = (regionIdParam: string = 'regionId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.adminUser) {
      return res.status(401).json({ success: false, error: '관리자 인증이 필요합니다' });
    }
    if (req.adminUser.role === 'system_admin') {
      return next(); // 시스템 어드민은 모든 지역 접근 가능
    }
    // region_admin은 자기 지역만
    const requestedRegionId = req.params[regionIdParam] || req.query.regionId || req.body?.regionId;
    if (requestedRegionId && requestedRegionId !== req.adminUser.regionId) {
      return res.status(403).json({
        success: false,
        error: '해당 지역에 대한 접근 권한이 없습니다',
      });
    }
    next();
  };
};

/**
 * 배달원 인증 미들웨어 (JWT 전용)
 * - 전화번호 기반 폴백 제거 (보안 강화)
 */
export const authenticateDriver = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: '배달원 인증이 필요합니다. Bearer 토큰을 제공해주세요.',
      });
    }

    const decoded = jwtService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않거나 만료된 토큰입니다',
      });
    }

    const driver = await prisma.driver.findFirst({
      where: { phone: decoded.phone },
    });

    if (!driver) {
      return res.status(401).json({
        success: false,
        error: '등록되지 않은 배달원입니다',
      });
    }

    req.user = {
      userId: driver.id,
      phone: decoded.phone,
      role: 'driver',
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '배달원 인증 처리 중 오류가 발생했습니다',
    });
  }
};

/**
 * 선택적 인증 미들웨어
 * - JWT가 있으면 검증하여 req.user에 설정
 * - JWT가 없으면 비인증 상태로 통과 (req.user = undefined)
 * - 잘못된/만료된 JWT가 있으면 401 반환
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return next(); // 토큰 없으면 비인증 상태로 통과
    }

    const decoded = jwtService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: '만료된 토큰입니다. 다시 인증해주세요.',
      });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: '올바른 접근 토큰이 아닙니다',
      });
    }

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (user && user.isActive) {
      req.user = {
        userId: decoded.userId,
        phone: decoded.phone,
        role: decoded.role || 'user',
      };
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '인증 처리 중 오류가 발생했습니다',
    });
  }
};

/**
 * 다중 역할 인증 미들웨어
 * - 고객 JWT, 배달원 JWT, 관리자 JWT/API Key 중 하나라도 유효하면 통과
 * - 주문 상세 조회 등 여러 역할이 접근 가능한 엔드포인트에 사용
 */
export const authenticateAny = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  // 1. 관리자 토큰 확인 (쿠키 또는 헤더)
  const adminToken = req.cookies?.admin_token || (req.headers['x-admin-token'] as string);
  if (adminToken) {
    return authenticateAdmin(req, res, next);
  }

  // 2. Bearer 토큰 확인
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: '인증이 필요합니다',
    });
  }

  const decoded = jwtService.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: '유효하지 않거나 만료된 토큰입니다',
    });
  }

  const role = decoded.role || 'user';

  if (role === 'driver') {
    const driver = await prisma.driver.findFirst({
      where: { phone: decoded.phone },
    });
    if (driver) {
      req.user = { userId: driver.id, phone: decoded.phone, role: 'driver' };
      return next();
    }
  }

  // user 또는 기타 역할
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });
  if (user && user.isActive) {
    req.user = { userId: decoded.userId, phone: decoded.phone, role: 'user' };
    return next();
  }

  return res.status(401).json({
    success: false,
    error: '유효하지 않은 사용자입니다',
  });
};

/**
 * 주문 소유권 검증 미들웨어
 * - 고객: 본인 주문만 접근 가능
 * - 배달원: 자신에게 배정된 주문만 접근 가능
 * - 관리자: 모든 주문 접근 가능
 */
export const verifyOrderOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = req.params.id;
    if (!orderId) {
      return res.status(400).json({ success: false, error: '주문 ID가 필요합니다' });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!req.user) {
      return res.status(401).json({ success: false, error: '인증이 필요합니다' });
    }

    switch (req.user.role) {
      case 'user':
        if (order.userId !== req.user.userId) {
          return res.status(403).json({
            success: false,
            error: '본인의 주문만 조회할 수 있습니다',
          });
        }
        break;
      case 'driver':
        if (order.driverId !== req.user.userId) {
          return res.status(403).json({
            success: false,
            error: '배정된 주문만 접근할 수 있습니다',
          });
        }
        break;
      case 'admin':
        break; // 관리자는 모든 주문 접근 가능
    }

    // 이후 핸들러에서 재조회 방지
    (req as any).order = order;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: '주문 소유권 확인 중 오류가 발생했습니다',
    });
  }
};

/**
 * 역할 기반 접근 제어 미들웨어 팩토리
 * @param allowedRoles 허용되는 역할 목록
 */
export const requireRole = (...allowedRoles: Array<'user' | 'driver' | 'admin'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: '접근 권한이 없습니다',
      });
    }

    next();
  };
};
