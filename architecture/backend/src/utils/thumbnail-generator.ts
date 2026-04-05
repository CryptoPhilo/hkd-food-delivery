/**
 * SVG 기반 썸네일 자동 생성 유틸리티
 * - 카테고리, 식당, 메뉴별 기본 썸네일 생성
 * - 이모지 + 그라데이션 배경 조합
 */

// ============================================
// 카테고리별 이모지 & 색상 매핑
// ============================================
const CATEGORY_THEMES: Record<string, { emoji: string; bg: [string, string]; textColor: string }> =
  {
    한식: { emoji: '🍚', bg: ['#FF6B35', '#FF8E53'], textColor: '#fff' },
    중식: { emoji: '🥟', bg: ['#E53935', '#FF5252'], textColor: '#fff' },
    '양식/피자': { emoji: '🍕', bg: ['#FFA726', '#FFB74D'], textColor: '#fff' },
    치킨: { emoji: '🍗', bg: ['#F9A825', '#FDD835'], textColor: '#5D4037' },
    분식: { emoji: '🍜', bg: ['#FF7043', '#FF8A65'], textColor: '#fff' },
    '고기/구이': { emoji: '🥩', bg: ['#8D6E63', '#A1887F'], textColor: '#fff' },
    횟집: { emoji: '🐟', bg: ['#29B6F6', '#4FC3F7'], textColor: '#fff' },
    카페: { emoji: '☕', bg: ['#795548', '#8D6E63'], textColor: '#fff' },
    기타: { emoji: '🍽️', bg: ['#78909C', '#90A4AE'], textColor: '#fff' },
  };

// 메뉴 키워드 → 이모지 매핑
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
  [/스테이크/, '🥩'],
  [/새우|해물|조개/, '🦐'],
  [/튀김|텐동|텐푸라/, '🍤'],
];

function getMenuEmoji(menuName: string): string {
  for (const [pattern, emoji] of MENU_EMOJI_MAP) {
    if (pattern.test(menuName)) return emoji;
  }
  return '🍽️';
}

function getCategoryTheme(category: string) {
  return CATEGORY_THEMES[category] || CATEGORY_THEMES['기타'];
}

// ============================================
// SVG 생성 함수
// ============================================

/**
 * 카테고리 썸네일 생성 (200x130)
 */
export function generateCategoryThumbnail(categoryName: string): string {
  const theme = getCategoryTheme(categoryName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="130" viewBox="0 0 200 130">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.bg[0]}"/>
      <stop offset="100%" style="stop-color:${theme.bg[1]}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="130" rx="16" fill="url(#bg)"/>
  <text x="100" y="78" text-anchor="middle" font-size="72">${theme.emoji}</text>
  <text x="100" y="118" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="bold" fill="${theme.textColor}">${escapeXml(categoryName)}</text>
</svg>`;
  return svgToDataUri(svg);
}

/**
 * 식당 썸네일 생성 (200x130) - 카테고리 기반 색상 + 메뉴 키워드 이모지
 */
export function generateRestaurantThumbnail(
  restaurantName: string,
  category?: string | null,
  menuKeywords?: string[],
): string {
  const theme = getCategoryTheme(category || '기타');
  let emoji = theme.emoji;
  if (menuKeywords && menuKeywords.length > 0) {
    const combined = menuKeywords.join(' ');
    emoji = getMenuEmoji(combined);
    if (emoji === '🍽️' && theme.emoji !== '🍽️') emoji = theme.emoji;
  }

  const displayName =
    restaurantName.length > 8 ? restaurantName.slice(0, 8) + '..' : restaurantName;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="130" viewBox="0 0 200 130">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.bg[0]}"/>
      <stop offset="100%" style="stop-color:${theme.bg[1]}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="130" rx="14" fill="url(#bg)"/>
  <text x="100" y="76" text-anchor="middle" font-size="68">${emoji}</text>
  <text x="100" y="118" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="600" fill="${theme.textColor}">${escapeXml(displayName)}</text>
</svg>`;
  return svgToDataUri(svg);
}

/**
 * 메뉴 썸네일 생성 (130x130)
 */
export function generateMenuThumbnail(menuName: string, category?: string | null): string {
  const emoji = getMenuEmoji(menuName);
  const theme = getCategoryTheme(category || '기타');

  const displayName = menuName.length > 6 ? menuName.slice(0, 6) + '..' : menuName;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="130" viewBox="0 0 130 130">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.bg[0]}"/>
      <stop offset="100%" style="stop-color:${theme.bg[1]}"/>
    </linearGradient>
  </defs>
  <rect width="130" height="130" rx="14" fill="url(#bg)"/>
  <text x="65" y="76" text-anchor="middle" font-size="68">${emoji}</text>
  <text x="65" y="118" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="600" fill="${theme.textColor}">${escapeXml(displayName)}</text>
</svg>`;
  return svgToDataUri(svg);
}

// ============================================
// 헬퍼 함수
// ============================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function svgToDataUri(svg: string): string {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export { CATEGORY_THEMES, getMenuEmoji, getCategoryTheme };
