/**
 * 썸네일 관리 라우트
 * - 카테고리/식당/메뉴 썸네일 조회 및 업로드
 * - 기본 SVG 썸네일 자동 생성
 * - 어드민 커스텀 이미지 업로드 (base64, 프론트에서 리사이즈 후 전송)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  generateCategoryThumbnail,
  generateRestaurantThumbnail,
  generateMenuThumbnail,
} from '../utils/thumbnail-generator';

const router = Router();
const prisma = new PrismaClient();

// 썸네일 크기 제한 (base64 기준 약 500KB)
const MAX_THUMBNAIL_SIZE = 500 * 1024;

// ========================================
// 공개 API: 카테고리 썸네일 목록 조회
// ========================================
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // settings 테이블에서 커스텀 카테고리 썸네일 조회
    const settings = await (prisma as any).setting.findMany({
      where: {
        key: { startsWith: 'category_thumbnail:' },
      },
    });

    const customThumbnails: Record<string, string> = {};
    for (const s of settings) {
      const catName = s.key.replace('category_thumbnail:', '');
      customThumbnails[catName] = s.value;
    }

    // 9개 표준 카테고리에 대해 커스텀 or 자동 생성 썸네일 반환
    const categories = [
      '한식',
      '중식',
      '양식/피자',
      '치킨',
      '분식',
      '고기/구이',
      '횟집',
      '카페',
      '기타',
    ];
    const result: Record<string, string> = {};
    for (const cat of categories) {
      result[cat] = customThumbnails[cat] || generateCategoryThumbnail(cat);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 어드민 API: 카테고리 썸네일 업로드
// ========================================
router.put('/categories/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    const { thumbnailUrl } = req.body;

    if (!thumbnailUrl || typeof thumbnailUrl !== 'string') {
      return res.status(400).json({ success: false, error: '썸네일 데이터가 필요합니다' });
    }

    if (thumbnailUrl.length > MAX_THUMBNAIL_SIZE) {
      return res
        .status(400)
        .json({ success: false, error: '이미지 크기가 너무 큽니다 (500KB 이하)' });
    }

    const key = `category_thumbnail:${name}`;

    await (prisma as any).setting.upsert({
      where: { key },
      create: {
        key,
        value: thumbnailUrl,
        type: 'thumbnail',
        description: `${name} 카테고리 썸네일`,
      },
      update: {
        value: thumbnailUrl,
      },
    });

    res.json({ success: true, data: { category: name, thumbnailUrl } });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 어드민 API: 카테고리 썸네일 초기화 (기본값 복원)
// ========================================
router.delete('/categories/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    const key = `category_thumbnail:${name}`;

    await (prisma as any).setting.deleteMany({ where: { key } });

    const defaultThumbnail = generateCategoryThumbnail(name);
    res.json({ success: true, data: { category: name, thumbnailUrl: defaultThumbnail } });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 어드민 API: 식당 썸네일 업로드
// ========================================
router.put('/restaurants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { thumbnailUrl } = req.body;

    if (!thumbnailUrl || typeof thumbnailUrl !== 'string') {
      return res.status(400).json({ success: false, error: '썸네일 데이터가 필요합니다' });
    }

    if (thumbnailUrl.length > MAX_THUMBNAIL_SIZE) {
      return res
        .status(400)
        .json({ success: false, error: '이미지 크기가 너무 큽니다 (500KB 이하)' });
    }

    const restaurant = await (prisma as any).restaurant.update({
      where: { id },
      data: { thumbnailUrl },
    });

    res.json({ success: true, data: restaurant });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 어드민 API: 식당 썸네일 초기화
// ========================================
router.delete('/restaurants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const restaurant = await (prisma as any).restaurant.update({
      where: { id },
      data: { thumbnailUrl: null },
    });

    res.json({ success: true, data: restaurant });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 어드민 API: 메뉴 썸네일 업로드
// ========================================
router.put('/menus/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { thumbnailUrl } = req.body;

    if (!thumbnailUrl || typeof thumbnailUrl !== 'string') {
      return res.status(400).json({ success: false, error: '썸네일 데이터가 필요합니다' });
    }

    if (thumbnailUrl.length > MAX_THUMBNAIL_SIZE) {
      return res
        .status(400)
        .json({ success: false, error: '이미지 크기가 너무 큽니다 (500KB 이하)' });
    }

    const menu = await (prisma as any).menu.update({
      where: { id },
      data: { thumbnailUrl },
    });

    res.json({ success: true, data: menu });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 어드민 API: 메뉴 썸네일 초기화
// ========================================
router.delete('/menus/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const menu = await (prisma as any).menu.update({
      where: { id },
      data: { thumbnailUrl: null },
    });

    res.json({ success: true, data: menu });
  } catch (error) {
    next(error);
  }
});

// ========================================
// 공개 API: 식당의 기본 썸네일 생성 (on-demand)
// ========================================
router.get('/generate/restaurant', (req: Request, res: Response) => {
  const { name, category, menuKeywords } = req.query;
  const keywords = menuKeywords ? String(menuKeywords).split(',') : undefined;
  const thumbnail = generateRestaurantThumbnail(
    String(name || '식당'),
    category ? String(category) : null,
    keywords,
  );
  res.json({ success: true, data: thumbnail });
});

// ========================================
// 공개 API: 메뉴의 기본 썸네일 생성 (on-demand)
// ========================================
router.get('/generate/menu', (req: Request, res: Response) => {
  const { name, category } = req.query;
  const thumbnail = generateMenuThumbnail(
    String(name || '메뉴'),
    category ? String(category) : null,
  );
  res.json({ success: true, data: thumbnail });
});

export default router;
