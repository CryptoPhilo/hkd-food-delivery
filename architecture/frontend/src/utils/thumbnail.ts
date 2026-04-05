/**
 * 프론트엔드 썸네일 유틸리티
 * - 카테고리/식당/메뉴 기본 SVG 썸네일 생성 (백엔드 미응답 시 폴백)
 * - 이미지 리사이즈 (Canvas API 기반, 어드민 업로드 시 사용)
 */

// ============================================
// 카테고리별 이모지 & 색상 매핑
// ============================================
const CATEGORY_THEMES: Record<string, { emoji: string; bg: [string, string]; textColor: string }> = {
  '한식': { emoji: '🍚', bg: ['#FF6B35', '#FF8E53'], textColor: '#fff' },
  '중식': { emoji: '🥟', bg: ['#E53935', '#FF5252'], textColor: '#fff' },
  '양식/피자': { emoji: '🍕', bg: ['#FFA726', '#FFB74D'], textColor: '#fff' },
  '치킨': { emoji: '🍗', bg: ['#F9A825', '#FDD835'], textColor: '#5D4037' },
  '분식': { emoji: '🍜', bg: ['#FF7043', '#FF8A65'], textColor: '#fff' },
  '고기/구이': { emoji: '🥩', bg: ['#8D6E63', '#A1887F'], textColor: '#fff' },
  '횟집': { emoji: '🐟', bg: ['#29B6F6', '#4FC3F7'], textColor: '#fff' },
  '카페': { emoji: '☕', bg: ['#795548', '#8D6E63'], textColor: '#fff' },
  '기타': { emoji: '🍽️', bg: ['#78909C', '#90A4AE'], textColor: '#fff' },
};

const MENU_EMOJI_MAP: [RegExp, string][] = [
  [/치킨|닭|후라이드|양념/, '🍗'],
  [/피자/, '🍕'],
  [/햄버거|버거/, '🍔'],
  [/국수|면|라멘|라면|우동|짬뽕|짜장/, '🍜'],
  [/초밥|스시|회|사시미/, '🍣'],
  [/돈까스|돈카츠|카츠/, '🍱'],
  [/떡볶이|떡/, '🍢'],
  [/김밥/, '🍙'],
  [/만두/, '🥟'],
  [/삼겹살|갈비|고기|불고기|소고기|돼지/, '🥩'],
  [/밥|비빔|볶음밥|덮밥|정식|백반/, '🍚'],
  [/찌개|탕|국|전골/, '🍲'],
  [/커피|아메리카노|라떼|카페/, '☕'],
  [/빵|베이커리|토스트|샌드위치/, '🥖'],
  [/케이크|디저트|와플|마카롱/, '🍰'],
  [/아이스크림|빙수|셰이크/, '🍨'],
  [/주스|스무디|음료/, '🥤'],
  [/맥주|소주|술|막걸리/, '🍺'],
  [/샐러드/, '🥗'],
  [/새우|해물|조개/, '🦐'],
  [/튀김/, '🍤'],
];

function getMenuEmoji(name: string): string {
  for (const [pattern, emoji] of MENU_EMOJI_MAP) {
    if (pattern.test(name)) return emoji;
  }
  return '🍽️';
}

function getCategoryTheme(category: string) {
  return CATEGORY_THEMES[category] || CATEGORY_THEMES['기타'];
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

// ============================================
// 공개 생성 함수
// ============================================

export function generateCategoryThumbnail(displayName: string, originalKoreanName?: string): string {
  const theme = getCategoryTheme(originalKoreanName || displayName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="130" viewBox="0 0 200 130">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:${theme.bg[0]}"/>
    <stop offset="100%" style="stop-color:${theme.bg[1]}"/>
  </linearGradient></defs>
  <rect width="200" height="130" rx="16" fill="url(#bg)"/>
  <text x="100" y="78" text-anchor="middle" font-size="72">${theme.emoji}</text>
  <text x="100" y="118" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="bold" fill="${theme.textColor}">${escapeXml(displayName)}</text>
</svg>`;
  return svgToDataUri(svg);
}

export function generateRestaurantThumbnail(name: string, category?: string | null, menuNames?: string[]): string {
  const theme = getCategoryTheme(category || '기타');
  let emoji = theme.emoji;
  if (menuNames && menuNames.length > 0) {
    const combined = menuNames.join(' ');
    const found = getMenuEmoji(combined);
    if (found !== '🍽️' || theme.emoji === '🍽️') emoji = found;
  }
  const displayName = name.length > 8 ? name.slice(0, 8) + '..' : name;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="130" viewBox="0 0 200 130">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:${theme.bg[0]}"/>
    <stop offset="100%" style="stop-color:${theme.bg[1]}"/>
  </linearGradient></defs>
  <rect width="200" height="130" rx="14" fill="url(#bg)"/>
  <text x="100" y="76" text-anchor="middle" font-size="68">${emoji}</text>
  <text x="100" y="118" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="600" fill="${theme.textColor}">${escapeXml(displayName)}</text>
</svg>`;
  return svgToDataUri(svg);
}

export function generateMenuThumbnail(menuName: string, category?: string | null): string {
  const emoji = getMenuEmoji(menuName);
  const theme = getCategoryTheme(category || '기타');
  const displayName = menuName.length > 6 ? menuName.slice(0, 6) + '..' : menuName;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="130" viewBox="0 0 130 130">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:${theme.bg[0]}"/>
    <stop offset="100%" style="stop-color:${theme.bg[1]}"/>
  </linearGradient></defs>
  <rect width="130" height="130" rx="14" fill="url(#bg)"/>
  <text x="65" y="76" text-anchor="middle" font-size="68">${emoji}</text>
  <text x="65" y="118" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="600" fill="${theme.textColor}">${escapeXml(displayName)}</text>
</svg>`;
  return svgToDataUri(svg);
}

// ============================================
// 이미지 리사이즈 유틸리티 (Canvas API)
// ============================================

interface ResizeOptions {
  maxWidth: number;
  maxHeight: number;
  quality?: number; // 0-1, JPEG quality
}

/**
 * 이미지 파일을 지정 크기로 리사이즈/크롭하여 base64 data URI로 반환
 * - 비율 유지하며 cover 모드로 크롭 (중앙 기준)
 * - 내용 훼손 최소화
 */
export function resizeImageFile(file: File, options: ResizeOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));

        const { maxWidth, maxHeight, quality = 0.85 } = options;
        canvas.width = maxWidth;
        canvas.height = maxHeight;

        // Cover crop: 비율 유지하며 전체 캔버스 채움, 초과 부분은 중앙 기준 크롭
        const imgRatio = img.width / img.height;
        const canvasRatio = maxWidth / maxHeight;

        let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;

        if (imgRatio > canvasRatio) {
          // 이미지가 더 넓음 → 좌우 크롭
          srcW = img.height * canvasRatio;
          srcX = (img.width - srcW) / 2;
        } else {
          // 이미지가 더 높음 → 상하 크롭
          srcH = img.width / canvasRatio;
          srcY = (img.height - srcH) / 2;
        }

        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, maxWidth, maxHeight);

        const dataUri = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUri);
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

// 썸네일 규격 상수
export const THUMBNAIL_SIZES = {
  category: { maxWidth: 200, maxHeight: 130 },
  restaurant: { maxWidth: 200, maxHeight: 130 },
  menu: { maxWidth: 130, maxHeight: 130 },
} as const;

export { CATEGORY_THEMES, getCategoryTheme, getMenuEmoji };
