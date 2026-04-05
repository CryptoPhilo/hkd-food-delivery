import { PrismaClient } from '@prisma/client';
import { generateFoodImage, buildFoodImagePrompt } from './GeminiImageService';
import {
  uploadImageToStorage,
  deleteImageFromStorage,
  buildMenuImagePath,
} from './ImageStorageService';
import logger from '../utils/logger';

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

// 진행 중인 생성 작업 추적 (중복 방지)
const generationInProgress = new Set<string>();

/**
 * 메뉴에 대한 AI 이미지 생성 및 저장
 * @param menuId - 메뉴 ID
 * @returns 생성된 이미지 URL 또는 null
 */
export async function generateAndSaveMenuImage(menuId: string): Promise<string | null> {
  try {
    // 중복 작업 방지
    if (generationInProgress.has(menuId)) {
      logger.warn(`Image generation already in progress for menu: ${menuId}`);
      return null;
    }

    generationInProgress.add(menuId);

    try {
      logger.info(`Starting image generation for menu: ${menuId}`);

      // 메뉴 데이터 조회
      const menu = await prisma.menu.findUnique({
        where: { id: menuId },
        include: {
          restaurant: {
            select: {
              category: true,
            },
          },
        },
      });

      if (!menu) {
        logger.error(`Menu not found: ${menuId}`);
        return null;
      }

      // 이미지 생성
      const imageBuffer = await generateFoodImage(menu.name, menu.restaurant.category);

      // Supabase Storage에 업로드
      const imagePath = buildMenuImagePath(menuId);
      const imageUrl = await uploadImageToStorage(imageBuffer, imagePath, 'image/png');

      // 데이터베이스에 URL 업데이트
      await (prisma.menu as any).update({
        where: { id: menuId },
        data: {
          thumbnailUrl: imageUrl,
          updatedAt: new Date(),
        },
      });

      logger.info(`Image generated and saved for menu: ${menuId}`, { imageUrl });
      return imageUrl;
    } finally {
      // 진행 중 표시 제거
      generationInProgress.delete(menuId);
    }
  } catch (error) {
    logger.error('Error generating and saving menu image', { menuId, error });
    generationInProgress.delete(menuId);
    return null;
  }
}

/**
 * 레스토랑의 모든 메뉴에 대해 AI 이미지 생성
 * @param restaurantId - 레스토랑 ID
 * @returns 성공/실패 개수
 */
export async function generateImagesForRestaurant(
  restaurantId: string,
): Promise<{ success: number; failed: number }> {
  try {
    logger.info(`Starting image generation for all menus in restaurant: ${restaurantId}`);

    // 레스토랑의 모든 메뉴 조회
    const menus = await prisma.menu.findMany({
      where: {
        restaurantId: restaurantId,
      },
      select: {
        id: true,
      },
    });

    if (menus.length === 0) {
      logger.info(`No menus found for restaurant: ${restaurantId}`);
      return { success: 0, failed: 0 };
    }

    logger.info(`Found ${menus.length} menus for restaurant ${restaurantId}`);

    let success = 0;
    let failed = 0;

    // 각 메뉴에 대해 이미지 생성
    for (const menu of menus) {
      try {
        const result = await generateAndSaveMenuImage(menu.id);
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        logger.error(`Failed to generate image for menu ${menu.id}`, { error });
        failed++;
      }
    }

    logger.info(`Batch generation complete for restaurant ${restaurantId}`, { success, failed });
    return { success, failed };
  } catch (error) {
    logger.error('Error generating images for restaurant', { restaurantId, error });
    return { success: 0, failed: 0 };
  }
}

/**
 * 모든 메뉴에 대해 전역 배치 이미지 생성 (레이트 제한 포함)
 * @param options - 옵션 { limit: 생성할 메뉴 최대 개수, delay: 각 생성 사이 지연 시간(ms) }
 * @returns 총 개수, 성공 개수, 실패 개수
 */
export async function batchGenerateAllMenuImages(options?: {
  limit?: number;
  delay?: number;
}): Promise<{ total: number; success: number; failed: number }> {
  try {
    const { limit, delay = 2000 } = options || {};

    logger.info(`Starting batch image generation for all menus`, { limit, delay });

    // AI 이미지가 없는 메뉴 조회
    const menus = await (prisma.menu as any).findMany({
      where: {
        OR: [{ thumbnailUrl: null }, { thumbnailUrl: { not: { contains: '/ai/' } } }],
      },
      select: {
        id: true,
      },
      take: limit,
    });

    if (menus.length === 0) {
      logger.info('No menus need AI image generation');
      return { total: 0, success: 0, failed: 0 };
    }

    logger.info(`Found ${menus.length} menus to generate images for`);

    let success = 0;
    let failed = 0;

    // 각 메뉴에 대해 이미지 생성 (지연 포함)
    for (let i = 0; i < menus.length; i++) {
      try {
        const result = await generateAndSaveMenuImage(menus[i].id);
        if (result) {
          success++;
        } else {
          failed++;
        }

        // 마지막 항목이 아니면 지연
        if (i < menus.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        logger.error(`Failed to generate image for menu ${menus[i].id}`, { error });
        failed++;
      }
    }

    logger.info(`Batch image generation complete`, { total: menus.length, success, failed });
    return { total: menus.length, success, failed };
  } catch (error) {
    logger.error('Error in batch image generation', { error });
    return { total: 0, success: 0, failed: 0 };
  }
}

/**
 * 실제 사진으로 AI 생성 이미지 대체
 * @param menuId - 메뉴 ID
 * @param imageBuffer - 실제 사진 버퍼
 * @returns 업로드된 이미지 URL
 */
export async function replaceWithRealImage(menuId: string, imageBuffer: Buffer): Promise<string> {
  try {
    logger.info(`Replacing image with real photo for menu: ${menuId}`);

    // 메뉴 정보 조회
    const menu = await prisma.menu.findUnique({
      where: { id: menuId },
    });

    if (!menu) {
      throw new Error(`Menu not found: ${menuId}`);
    }

    // 기존 AI 이미지 삭제
    if ((menu as any).thumbnailUrl && (menu as any).thumbnailUrl.includes('/ai/')) {
      try {
        const oldPath = buildMenuImagePath(menuId);
        await deleteImageFromStorage(oldPath);
      } catch (error) {
        logger.warn(`Failed to delete old AI image for menu ${menuId}`, { error });
      }
    }

    // 실제 사진을 'real' 폴더에 업로드
    const imagePath = `real/menus/${menuId}.png`;
    const imageUrl = await uploadImageToStorage(imageBuffer, imagePath, 'image/png');

    // 데이터베이스에 URL 업데이트
    await (prisma.menu as any).update({
      where: { id: menuId },
      data: {
        thumbnailUrl: imageUrl,
        updatedAt: new Date(),
      },
    });

    logger.info(`Real image uploaded for menu: ${menuId}`, { imageUrl });
    return imageUrl;
  } catch (error) {
    logger.error('Error replacing image with real photo', { menuId, error });
    throw error;
  }
}

/**
 * URL이 AI 생성 이미지인지 확인
 * @param url - 이미지 URL
 * @returns AI 생성 여부
 */
export function isAIGeneratedImage(url: string): boolean {
  return url.includes('/ai/');
}

/**
 * URL이 실제 사진인지 확인
 * @param url - 이미지 URL
 * @returns 실제 사진 여부
 */
export function isRealImage(url: string): boolean {
  return url.includes('/real/');
}
