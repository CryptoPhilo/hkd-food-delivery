/**
 * 어드민 인증 라우트 (로그인, 초기 계정 설정 등)
 * authenticateAdmin 미들웨어 없이 접근 가능
 */
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return salt + ':' + derivedKey.toString('hex');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  if (!salt || !key) return false;
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
}
import { jwtService } from '../services/JWTTokenService';
import {
  authenticateAdmin,
  requireSystemAdmin,
  AuthenticatedRequest,
} from '../middleware/auth.middleware';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// 로그인 (인증 불필요)
// ============================================
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '아이디와 비밀번호를 입력해주세요',
      });
    }

    const adminUser = await (prisma as any).adminUser.findUnique({
      where: { username },
      include: { region: true },
    });

    if (!adminUser) {
      return res.status(401).json({
        success: false,
        error: '아이디 또는 비밀번호가 일치하지 않습니다',
      });
    }

    if (!adminUser.isActive) {
      return res.status(403).json({
        success: false,
        error: '비활성화된 계정입니다. 시스템 관리자에게 문의하세요.',
      });
    }

    const isPasswordValid = await verifyPassword(password, adminUser.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '아이디 또는 비밀번호가 일치하지 않습니다',
      });
    }

    // JWT 토큰 생성 (어드민 전용 - role: 'admin' 명시)
    const token = jwtService.generateAccessToken(adminUser.id, `admin:${adminUser.id}`, 'admin');

    // 마지막 로그인 시간 업데이트
    await (prisma as any).adminUser.update({
      where: { id: adminUser.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info(`Admin login: ${adminUser.username} (${adminUser.role})`);

    // [SECURITY] H-1: httpOnly 쿠키로 admin JWT 전달
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15분 (access token 만료와 동일)
      path: '/',
    });

    res.json({
      success: true,
      data: {
        admin: {
          id: adminUser.id,
          username: adminUser.username,
          name: adminUser.name,
          role: adminUser.role,
          regionId: adminUser.regionId,
          regionName: adminUser.region?.name || null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// 초기 시스템 어드민 생성 (admin_users 테이블이 비어있을 때만)
// ============================================
router.post('/setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existingAdmins = await (prisma as any).adminUser.count();
    if (existingAdmins > 0) {
      return res.status(400).json({
        success: false,
        error: '이미 관리자 계정이 존재합니다. 로그인 후 계정을 관리해주세요.',
      });
    }

    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({
        success: false,
        error: '아이디, 비밀번호, 이름을 모두 입력해주세요',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '비밀번호는 6자 이상이어야 합니다',
      });
    }

    const passwordHash = await hashPassword(password);

    const adminUser = await (prisma as any).adminUser.create({
      data: {
        username,
        passwordHash,
        name,
        role: 'system_admin',
        regionId: null,
      },
    });

    logger.info(`Initial system admin created: ${adminUser.username}`);

    res.status(201).json({
      success: true,
      data: {
        id: adminUser.id,
        username: adminUser.username,
        name: adminUser.name,
        role: adminUser.role,
      },
      message: '시스템 관리자 계정이 생성되었습니다. 로그인해주세요.',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// 현재 로그인 상태 확인 (인증 필요)
// ============================================
router.get('/me', authenticateAdmin, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.adminUser) {
    return res.status(401).json({ success: false, error: '인증 정보 없음' });
  }

  const adminUser = await (prisma as any).adminUser.findUnique({
    where: { id: req.adminUser.id },
    include: { region: true },
  });

  if (!adminUser) {
    return res.status(404).json({ success: false, error: '관리자를 찾을 수 없습니다' });
  }

  res.json({
    success: true,
    data: {
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
      role: adminUser.role,
      regionId: adminUser.regionId,
      regionName: adminUser.region?.name || null,
    },
  });
});

// ============================================
// 로그아웃 (쿠키 삭제)
// ============================================
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('admin_token', { path: '/' });
  res.json({ success: true, message: '로그아웃 되었습니다' });
});

// ============================================
// 비밀번호 변경 (인증 필요)
// ============================================
router.put(
  '/change-password',
  authenticateAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ success: false, error: '인증 필요' });
      }

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ success: false, error: '현재 비밀번호와 새 비밀번호를 입력해주세요' });
      }

      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ success: false, error: '새 비밀번호는 6자 이상이어야 합니다' });
      }

      const adminUser = await (prisma as any).adminUser.findUnique({
        where: { id: req.adminUser.id },
      });
      if (!adminUser) {
        return res.status(404).json({ success: false, error: '관리자를 찾을 수 없습니다' });
      }

      const isValid = await verifyPassword(currentPassword, adminUser.passwordHash);
      if (!isValid) {
        return res.status(401).json({ success: false, error: '현재 비밀번호가 일치하지 않습니다' });
      }

      const newHash = await hashPassword(newPassword);
      await (prisma as any).adminUser.update({
        where: { id: req.adminUser.id },
        data: { passwordHash: newHash },
      });

      res.json({ success: true, message: '비밀번호가 변경되었습니다' });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// 어드민 계정 관리 (시스템 어드민 전용)
// ============================================

// 어드민 목록 조회
router.get(
  '/accounts',
  authenticateAdmin,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const admins = await (prisma as any).adminUser.findMany({
        include: { region: { select: { id: true, name: true, code: true } as any } },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        success: true,
        data: admins.map((a) => ({
          id: a.id,
          username: a.username,
          name: a.name,
          role: a.role,
          regionId: a.regionId,
          regionName: a.region?.name || null,
          isActive: a.isActive,
          lastLoginAt: a.lastLoginAt,
          createdAt: a.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// 어드민 계정 생성
router.post(
  '/accounts',
  authenticateAdmin,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { username, password, name, role, regionId } = req.body;

      if (!username || !password || !name || !role) {
        return res.status(400).json({ success: false, error: '필수 항목을 모두 입력해주세요' });
      }

      if (!['system_admin', 'region_admin'].includes(role)) {
        return res.status(400).json({ success: false, error: '올바른 역할을 선택해주세요' });
      }

      if (role === 'region_admin' && !regionId) {
        return res
          .status(400)
          .json({ success: false, error: '지역 어드민은 지역을 선택해야 합니다' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, error: '비밀번호는 6자 이상이어야 합니다' });
      }

      const existing = await (prisma as any).adminUser.findUnique({ where: { username } });
      if (existing) {
        return res.status(409).json({ success: false, error: '이미 존재하는 아이디입니다' });
      }

      if (regionId) {
        const region = await (prisma as any).region.findUnique({ where: { id: regionId } });
        if (!region) {
          return res.status(400).json({ success: false, error: '존재하지 않는 지역입니다' });
        }
      }

      const passwordHash = await hashPassword(password);

      const adminUser = await (prisma as any).adminUser.create({
        data: {
          username,
          passwordHash,
          name,
          role,
          regionId: role === 'system_admin' ? null : regionId,
        },
        include: { region: { select: { name: true } } },
      });

      logger.info(
        `Admin account created: ${adminUser.username} (${adminUser.role}) by ${req.adminUser?.username}`,
      );

      res.status(201).json({
        success: true,
        data: {
          id: adminUser.id,
          username: adminUser.username,
          name: adminUser.name,
          role: adminUser.role,
          regionId: adminUser.regionId,
          regionName: adminUser.region?.name || null,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// 어드민 계정 수정
router.put(
  '/accounts/:id',
  authenticateAdmin,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, role, regionId, isActive, password } = req.body;

      const adminUser = await (prisma as any).adminUser.findUnique({ where: { id } });
      if (!adminUser) {
        return res.status(404).json({ success: false, error: '관리자를 찾을 수 없습니다' });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) {
        if (!['system_admin', 'region_admin'].includes(role)) {
          return res.status(400).json({ success: false, error: '올바른 역할을 선택해주세요' });
        }
        updateData.role = role;
      }
      if (regionId !== undefined) updateData.regionId = regionId || null;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (password) {
        if (password.length < 6) {
          return res
            .status(400)
            .json({ success: false, error: '비밀번호는 6자 이상이어야 합니다' });
        }
        updateData.passwordHash = await hashPassword(password);
      }

      const updated = await (prisma as any).adminUser.update({
        where: { id },
        data: updateData,
        include: { region: { select: { name: true } } },
      });

      res.json({
        success: true,
        data: {
          id: updated.id,
          username: updated.username,
          name: updated.name,
          role: updated.role,
          regionId: updated.regionId,
          regionName: updated.region?.name || null,
          isActive: updated.isActive,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// 어드민 계정 삭제
router.delete(
  '/accounts/:id',
  authenticateAdmin,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (req.adminUser?.id === id) {
        return res.status(400).json({ success: false, error: '자기 자신은 삭제할 수 없습니다' });
      }

      await (prisma as any).adminUser.delete({ where: { id } });

      res.json({ success: true, message: '관리자 계정이 삭제되었습니다' });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// 지역 관리 (시스템 어드민 전용)
// ============================================

// 지역 목록 조회
router.get(
  '/regions',
  authenticateAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const regions = await (prisma as any).region.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          _count: {
            select: {
              restaurants: true,
              drivers: true,
              orders: true,
              adminUsers: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: regions.map((r: any) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          nameEn: r.nameEn,
          centerLatitude: r.centerLatitude,
          centerLongitude: r.centerLongitude,
          addressKeyword: r.addressKeyword,
          isActive: r.isActive,
          platformHours: r.platformHours,
          deliveryFeeSettings: r.deliveryFeeSettings,
          domain: r.domain,
          restaurantCount: r._count.restaurants,
          driverCount: r._count.drivers,
          orderCount: r._count.orders,
          adminCount: r._count.adminUsers,
          createdAt: r.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// 지역 생성 (시스템 어드민 전용)
router.post(
  '/regions',
  authenticateAdmin,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const {
        code,
        name,
        nameEn,
        centerLatitude,
        centerLongitude,
        addressKeywords,
        addressKeyword,
        domain,
        platformHours,
        deliveryFeeSettings,
        autoScrape,
      } = req.body;

      if (!code || !name) {
        return res.status(400).json({ success: false, error: '지역 코드와 이름은 필수입니다' });
      }

      const existing = await (prisma as any).region.findUnique({ where: { code } });
      if (existing) {
        return res.status(409).json({ success: false, error: '이미 존재하는 지역 코드입니다' });
      }

      // 복수 행정구역명 지원: addressKeywords(배열) 또는 addressKeyword(문자열) 둘 다 지원
      let keywords = '';
      if (Array.isArray(addressKeywords) && addressKeywords.length > 0) {
        keywords = addressKeywords.filter((k: string) => k.trim()).join(',');
      } else if (addressKeyword) {
        keywords = addressKeyword;
      }

      const region = await (prisma as any).region.create({
        data: {
          code,
          name,
          nameEn: nameEn || null,
          centerLatitude: centerLatitude || 0,
          centerLongitude: centerLongitude || 0,
          addressKeyword: keywords,
          domain: domain && domain.trim() ? domain.trim() : null,
          platformHours: platformHours || { openTime: '09:00', closeTime: '22:00', isActive: true },
          deliveryFeeSettings: deliveryFeeSettings || {
            baseFee: 3000,
            perKmFee: 500,
            maxDistance: 5.0,
            freeDeliveryThreshold: 30000,
          },
        },
      });

      logger.info(`Region created: ${region.name} (${region.code}) by ${req.adminUser?.username}`);

      // 자동 식당 수집 (백그라운드, 실패해도 지역 생성에 영향 없음)
      if (autoScrape && keywords) {
        const keywordList = keywords
          .split(',')
          .map((k: string) => k.trim())
          .filter(Boolean);
        (async () => {
          try {
            const { diningCodeScraperService } =
              await import('../services/DiningCodeScraperService');
            let totalSynced = 0;

            for (const keyword of keywordList) {
              try {
                const restaurants = await diningCodeScraperService.scrapeRestaurants(keyword, 30);
                if (restaurants && restaurants.length > 0) {
                  for (const place of restaurants) {
                    try {
                      // naverPlaceId가 이미 있으면 업데이트, 없으면 생성
                      const existingRest = place.id
                        ? await prisma.restaurant.findFirst({
                            where: { naverPlaceId: place.id },
                          })
                        : null;

                      if (existingRest) {
                        // 이미 존재하면 regionId만 업데이트
                        await (prisma.restaurant as any).update({
                          where: { id: existingRest.id },
                          data: { regionId: region.id },
                        });
                      } else {
                        await (prisma.restaurant as any).create({
                          data: {
                            regionId: region.id,
                            naverPlaceId: place.id || null,
                            name: place.name,
                            address: place.address || keyword,
                            roadAddress: place.roadAddress || null,
                            latitude: place.latitude || region.centerLatitude,
                            longitude: place.longitude || region.centerLongitude,
                            phone: place.phone || null,
                            category: place.category || null,
                            isActive: false, // 비활성 상태 (메뉴 수집 전)
                            isDeliverable: false, // 배달 불가 상태
                          },
                        });
                      }
                      totalSynced++;
                    } catch (syncErr: any) {
                      logger.error(`Failed to sync restaurant ${place.name}`, {
                        error: syncErr.message,
                      });
                    }
                  }
                }
              } catch (scrapeErr: any) {
                logger.error(`Failed to scrape for keyword "${keyword}"`, {
                  error: scrapeErr.message,
                });
              }
            }
            logger.info(
              `Auto-scrape completed for region ${region.code}: ${totalSynced} restaurants synced (inactive)`,
            );
          } catch (bgError: any) {
            logger.error(`Background scrape failed for region ${region.code}`, {
              error: bgError.message,
            });
          }
        })();
      }

      res.status(201).json({ success: true, data: region });
    } catch (error) {
      next(error);
    }
  },
);

// 지역 수정
router.put(
  '/regions/:regionId',
  authenticateAdmin,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { regionId } = req.params;
      const {
        name,
        nameEn,
        centerLatitude,
        centerLongitude,
        addressKeyword,
        domain,
        isActive,
        platformHours,
        deliveryFeeSettings,
      } = req.body;

      const region = await (prisma as any).region.findUnique({ where: { id: regionId } });
      if (!region) {
        return res.status(404).json({ success: false, error: '지역을 찾을 수 없습니다' });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (nameEn !== undefined) updateData.nameEn = nameEn;
      if (centerLatitude !== undefined) updateData.centerLatitude = centerLatitude;
      if (centerLongitude !== undefined) updateData.centerLongitude = centerLongitude;
      if (addressKeyword !== undefined) updateData.addressKeyword = addressKeyword;
      if (domain !== undefined) updateData.domain = domain || null;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (platformHours !== undefined) updateData.platformHours = platformHours;
      if (deliveryFeeSettings !== undefined) updateData.deliveryFeeSettings = deliveryFeeSettings;

      const updated = await (prisma as any).region.update({
        where: { id: regionId },
        data: updateData,
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },
);

// 지역 삭제 (시스템 어드민 전용, 하위 데이터 있으면 불가)
router.delete(
  '/regions/:regionId',
  authenticateAdmin,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { regionId } = req.params;

      const counts = await (prisma as any).region.findUnique({
        where: { id: regionId },
        include: {
          _count: { select: { restaurants: true, orders: true, drivers: true } },
        },
      });

      if (!counts) {
        return res.status(404).json({ success: false, error: '지역을 찾을 수 없습니다' });
      }

      if (counts._count.restaurants > 0 || counts._count.orders > 0 || counts._count.drivers > 0) {
        return res.status(400).json({
          success: false,
          error: `해당 지역에 식당(${counts._count.restaurants}), 주문(${counts._count.orders}), 배달원(${counts._count.drivers})이 있어 삭제할 수 없습니다. 먼저 데이터를 이전하세요.`,
        });
      }

      await (prisma as any).region.delete({ where: { id: regionId } });

      res.json({ success: true, message: '지역이 삭제되었습니다' });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
