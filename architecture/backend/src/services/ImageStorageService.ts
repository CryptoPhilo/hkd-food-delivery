import axios from 'axios';
import logger from '../utils/logger';

// Supabase 설정
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'menu-images';

/**
 * 메뉴 이미지 경로 생성
 * @param menuId - 메뉴 ID
 * @returns 스토리지 경로
 */
export function buildMenuImagePath(menuId: string): string {
  return `ai/menus/${menuId}.png`;
}

/**
 * 레스토랑 이미지 경로 생성
 * @param restaurantId - 레스토랑 ID
 * @returns 스토리지 경로
 */
export function buildRestaurantImagePath(restaurantId: string): string {
  return `ai/restaurants/${restaurantId}.png`;
}

/**
 * Supabase Storage에 이미지 업로드
 * @param buffer - 이미지 버퍼
 * @param path - 스토리지 경로
 * @param contentType - MIME 타입 (기본: image/png)
 * @returns 공개 URL
 */
export async function uploadImageToStorage(
  buffer: Buffer,
  path: string,
  contentType: string = 'image/png',
): Promise<string> {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Supabase credentials are not configured (SUPABASE_URL, SUPABASE_KEY)');
    }

    logger.info(`Uploading image to Supabase Storage: ${path}`);

    // Supabase Storage REST API 엔드포인트
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${path}`;

    // 이미지 업로드
    const response = await axios.post(uploadUrl, buffer, {
      headers: {
        'Content-Type': contentType,
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      timeout: 30000,
    });

    if (response.status !== 200) {
      throw new Error(`Failed to upload image: ${response.status} ${response.statusText}`);
    }

    // 공개 URL 생성
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${path}`;

    logger.info(`Image uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    logger.error('Error uploading image to Supabase Storage', { path, error });
    throw error;
  }
}

/**
 * Supabase Storage에서 이미지 삭제
 * @param path - 스토리지 경로
 */
export async function deleteImageFromStorage(path: string): Promise<void> {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Supabase credentials are not configured');
    }

    logger.info(`Deleting image from Supabase Storage: ${path}`);

    // Supabase Storage REST API 엔드포인트
    const deleteUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${path}`;

    // 이미지 삭제
    const response = await axios.delete(deleteUrl, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      timeout: 30000,
    });

    if (response.status !== 200) {
      throw new Error(`Failed to delete image: ${response.status} ${response.statusText}`);
    }

    logger.info(`Image deleted successfully: ${path}`);
  } catch (error) {
    logger.error('Error deleting image from Supabase Storage', { path, error });
    throw error;
  }
}
