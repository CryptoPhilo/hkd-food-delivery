import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { generateFoodImage, buildFoodImagePrompt } from '../services/GeminiImageService';
import {
  uploadImageToStorage,
  buildMenuImagePath,
  deleteImageFromStorage,
} from '../services/ImageStorageService';
import {
  generateAndSaveMenuImage,
  generateImagesForRestaurant,
  batchGenerateAllMenuImages,
  replaceWithRealImage,
  isAIGeneratedImage,
  isRealImage,
} from '../services/MenuImageGenerationService';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// 단일 메뉴 AI 이미지 생성
// ============================================
router.post('/generate/menu/:menuId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { menuId } = req.params;
    const url = await generateAndSaveMenuImage(menuId);
    if (url) {
      res.json({ success: true, data: { menuId, imageUrl: url } });
    } else {
      res.status(500).json({ success: false, error: '이미지 생성 실패' });
    }
  } catch (error: any) {
    logger.error('[AI-Image] 단일 생성 실패', { error: error.message });
    next(error);
  }
});

// ============================================
// 식당 전체 메뉴 AI 이미지 일괄 생성
// ============================================
router.post(
  '/generate/restaurant/:restaurantId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId } = req.params;
      const result = await generateImagesForRestaurant(restaurantId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('[AI-Image] 식당 일괄 생성 실패', { error: error.message });
      next(error);
    }
  },
);

// ============================================
// 전체 배치 생성
// ============================================
router.post('/generate/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, delay } = req.body || {};
    const isAsync = req.query.async === 'true';

    if (isAsync) {
      // 비동기 실행
      batchGenerateAllMenuImages({ limit, delay }).catch((err) => {
        logger.error('[AI-Image] 배치 비동기 실행 실패', { error: err.message });
      });
      res.json({ success: true, message: '배치 작업이 시작되었습니다' });
    } else {
      const result = await batchGenerateAllMenuImages({ limit, delay });
      res.json({ success: true, data: result });
    }
  } catch (error: any) {
    logger.error('[AI-Image] 배치 생성 실패', { error: error.message });
    next(error);
  }
});

// ============================================
// 프롬프트 미리보기 (메뉴 ID 기준)
// ============================================
router.get('/preview-prompt/:menuId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { menuId } = req.params;
    const menu = await (prisma.menu as any).findUnique({
      where: { id: menuId },
      include: { restaurant: { select: { category: true } } },
    });
    if (!menu) {
      return res.status(404).json({ success: false, error: '메뉴를 찾을 수 없습니다' });
    }
    const prompt = buildFoodImagePrompt(menu.name, menu.restaurant?.category);
    res.json({ success: true, data: { menuId, menuName: menu.name, prompt } });
  } catch (error: any) {
    next(error);
  }
});

// ============================================
// 프롬프트 미리보기 (이름 기준)
// ============================================
router.get('/preview-prompt-by-name', async (req: Request, res: Response) => {
  const name = req.query.name as string;
  const category = req.query.category as string | undefined;
  if (!name) {
    return res.status(400).json({ success: false, error: 'name 파라미터 필요' });
  }
  const prompt = buildFoodImagePrompt(name, category);
  res.json({ success: true, data: { menuName: name, prompt } });
});

// ============================================
// 실제 이미지 업로드 (base64)
// ============================================
router.put('/upload/menu/:menuId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { menuId } = req.params;
    const { image } = req.body; // base64 string
    if (!image) {
      return res.status(400).json({ success: false, error: 'image (base64) 필요' });
    }
    const buffer = Buffer.from(image, 'base64');
    const url = await replaceWithRealImage(menuId, buffer);
    res.json({ success: true, data: { menuId, imageUrl: url } });
  } catch (error: any) {
    logger.error('[AI-Image] 실제 이미지 업로드 실패', { error: error.message });
    next(error);
  }
});

// ============================================
// 이미지 커버리지 통계
// ============================================
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const totalMenus = await prisma.menu.count();
    const withImage = await (prisma.menu as any).count({ where: { thumbnailUrl: { not: null } } });
    const withoutImage = totalMenus - withImage;

    res.json({
      success: true,
      data: {
        totalMenus,
        withImage,
        withoutImage,
        coverage: totalMenus > 0 ? ((withImage / totalMenus) * 100).toFixed(1) + '%' : '0%',
      },
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
