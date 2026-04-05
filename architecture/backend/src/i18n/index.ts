/**
 * Backend i18n — simple translation function for SMS messages
 * Uses the same key structure as frontend translation files
 */

import ko from './messages/ko.json';
import en from './messages/en.json';
import ja from './messages/ja.json';
import zh from './messages/zh.json';
import fr from './messages/fr.json';
import de from './messages/de.json';
import es from './messages/es.json';

const messages: Record<string, any> = { ko, en, ja, zh, fr, de, es };

const SUPPORTED_LOCALES = ['ko', 'en', 'ja', 'zh', 'fr', 'de', 'es'];

/**
 * Get a nested value from an object using dot-notation key
 */
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Translate a key with optional parameter substitution
 * Falls back to English, then Korean, then returns the key itself
 */
export function t(locale: string, key: string, params?: Record<string, string | number>): string {
  const lang = SUPPORTED_LOCALES.includes(locale) ? locale : 'en';

  let text =
    getNestedValue(messages[lang], key) ||
    getNestedValue(messages['en'], key) ||
    getNestedValue(messages['ko'], key) ||
    key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}

export function isValidLocale(locale: string): boolean {
  return SUPPORTED_LOCALES.includes(locale);
}

export const DEFAULT_LOCALE = 'ko';
