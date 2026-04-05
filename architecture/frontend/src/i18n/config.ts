export const locales = ['ko', 'en', 'ja', 'zh', 'fr', 'de', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
};

// locale → PortOne locale mapping
export const PORTONE_LOCALE_MAP: Record<string, string> = {
  ko: 'KO_KR',
  en: 'EN_US',
  ja: 'JA_JP',
  zh: 'ZH_CN',
  fr: 'FR_FR',
  de: 'DE_DE',
  es: 'ES_ES',
};

export function getPortOneLocale(locale: string): string {
  return PORTONE_LOCALE_MAP[locale] ?? 'EN_US';
}

// locale → default country code mapping (for phone input)
export const LOCALE_TO_COUNTRY: Record<string, string> = {
  ko: 'KR',
  en: 'US',
  ja: 'JP',
  zh: 'CN',
  fr: 'FR',
  de: 'DE',
  es: 'ES',
};

export const PRIORITY_COUNTRIES = ['KR', 'US', 'JP', 'CN', 'FR', 'DE', 'ES'];

// DB 한국어 카테고리명 → foodCategory i18n 키 매핑
export const CATEGORY_I18N_KEY: Record<string, string> = {
  '한식': 'foodCategory.korean',
  '중식': 'foodCategory.chinese',
  '양식/피자': 'foodCategory.western',
  '치킨': 'foodCategory.chicken',
  '분식': 'foodCategory.bunsik',
  '고기/구이': 'foodCategory.meat',
  '횟집': 'foodCategory.japanese',
  '카페': 'foodCategory.cafe',
  '기타': 'foodCategory.other',
};

/**
 * DB에서 온 한국어 카테고리명을 i18n 키로 변환
 * 매핑에 없으면 원본 그대로 반환
 */
export function getCategoryI18nKey(koreanName: string): string | null {
  return CATEGORY_I18N_KEY[koreanName] || null;
}

// locale flag emoji mapping (for admin/driver locale badge)
export const LOCALE_FLAGS: Record<string, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
  zh: '🇨🇳',
  fr: '🇫🇷',
  de: '🇩🇪',
  es: '🇪🇸',
};
