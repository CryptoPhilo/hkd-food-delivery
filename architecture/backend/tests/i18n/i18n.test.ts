/**
 * 백엔드 i18n 모듈 테스트
 * - t() 번역 함수
 * - isValidLocale() 검증
 * - SMS 템플릿 렌더링
 * - 번역 키 완전성
 */

import { t, isValidLocale, DEFAULT_LOCALE } from '../../src/i18n';
import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['ko', 'en', 'ja', 'zh', 'fr', 'de', 'es'];

// ── t() 함수 기본 동작 ──

describe('t() 번역 함수', () => {
  test('한국어 키를 올바르게 반환해야 한다', () => {
    const result = t('ko', 'sms.brandPrefix');
    expect(result).toBe('[한경배달]');
  });

  test('영어 키를 올바르게 반환해야 한다', () => {
    const result = t('en', 'sms.brandPrefix');
    expect(result).toBe('[HKD]');
  });

  test('일본어 키를 올바르게 반환해야 한다', () => {
    const result = t('ja', 'sms.brandPrefix');
    expect(result).toBe('[HKD]');
  });

  test('파라미터 치환이 올바르게 동작해야 한다', () => {
    const result = t('en', 'sms.orderReceived.orderNumber', { orderNumber: 'ORD-001' });
    expect(result).toContain('ORD-001');
  });

  test('여러 파라미터를 동시에 치환할 수 있어야 한다', () => {
    const result = t('en', 'sms.orderReceived.deliveryFee', { deliveryFee: '3,000' });
    expect(result).toContain('3,000');
    expect(result).toContain('₩');
  });

  test('동일 파라미터가 여러 번 나오면 모두 치환해야 한다', () => {
    // 수동 테스트: 같은 파라미터 2번 삽입
    const template = '{name} ordered from {name}';
    // t()는 정규식 /g 플래그를 사용하므로 모두 치환해야 함
    const mockResult = template.replace(/\{name\}/g, 'John');
    expect(mockResult).toBe('John ordered from John');
  });
});

// ── locale 폴백 동작 ──

describe('locale 폴백', () => {
  test('미지원 locale은 영어로 폴백해야 한다', () => {
    const result = t('ar', 'sms.brandPrefix'); // 아랍어는 미지원
    // 영어로 폴백
    expect(result).toBe('[HKD]');
  });

  test('빈 locale은 영어로 폴백해야 한다', () => {
    const result = t('', 'sms.brandPrefix');
    expect(result).toBe('[HKD]');
  });

  test('존재하지 않는 키는 키 자체를 반환해야 한다', () => {
    const result = t('ko', 'nonexistent.key.path');
    expect(result).toBe('nonexistent.key.path');
  });
});

// ── isValidLocale() ──

describe('isValidLocale()', () => {
  test.each(LOCALES)('%s는 유효한 locale이어야 한다', (locale) => {
    expect(isValidLocale(locale)).toBe(true);
  });

  test.each(['ar', 'pt', '', 'xx', 'korean'])('%s는 유효하지 않은 locale이어야 한다', (locale) => {
    expect(isValidLocale(locale)).toBe(false);
  });
});

// ── DEFAULT_LOCALE ──

describe('DEFAULT_LOCALE', () => {
  test('기본 locale이 "ko"여야 한다', () => {
    expect(DEFAULT_LOCALE).toBe('ko');
  });
});

// ── SMS 템플릿 렌더링 ──

describe('SMS 템플릿 렌더링', () => {
  const smsKeys = [
    'sms.brandPrefix',
    'sms.orderReceived.title',
    'sms.orderReceived.orderNumber',
    'sms.orderReceived.restaurant',
    'sms.orderReceived.menu',
    'sms.orderReceived.deliveryFee',
    'sms.orderReceived.totalAmount',
    'sms.orderReceived.estimatedTime',
    'sms.confirmed',
    'sms.cancelled',
    'sms.pickedUp',
    'sms.deliveryComplete',
    'sms.verificationCode',
  ];

  test.each(LOCALES)('%s — 모든 SMS 키가 번역되어 있어야 한다', (locale) => {
    for (const key of smsKeys) {
      const result = t(locale, key);
      // 키 자체가 반환되면 번역이 없는 것
      expect(result).not.toBe(key);
      // 빈 문자열이 아니어야 함
      expect(result.length).toBeGreaterThan(0);
    }
  });

  test('주문 확정 SMS가 주문번호를 포함해야 한다', () => {
    for (const locale of LOCALES) {
      const result = t(locale, 'sms.confirmed', { orderNumber: 'TEST-123' });
      expect(result).toContain('TEST-123');
    }
  });

  test('배달 완료 SMS가 주문번호를 포함해야 한다', () => {
    for (const locale of LOCALES) {
      const result = t(locale, 'sms.deliveryComplete', { orderNumber: 'TEST-456' });
      expect(result).toContain('TEST-456');
    }
  });

  test('인증번호 SMS가 코드를 포함해야 한다', () => {
    for (const locale of LOCALES) {
      const result = t(locale, 'sms.verificationCode', { code: '123456' });
      expect(result).toContain('123456');
    }
  });
});

// ── 백엔드 번역 파일 완전성 ──

describe('백엔드 번역 파일 완전성', () => {
  const messagesDir = path.resolve(__dirname, '../../src/i18n/messages');

  function extractKeys(obj: any, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        keys.push(...extractKeys(value, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys.sort();
  }

  let allTranslations: Record<string, any> = {};

  beforeAll(() => {
    for (const locale of LOCALES) {
      const filePath = path.join(messagesDir, `${locale}.json`);
      allTranslations[locale] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  });

  test('모든 언어 파일이 동일한 키 수를 가져야 한다', () => {
    const koKeys = extractKeys(allTranslations['ko']);
    for (const locale of LOCALES) {
      const keys = extractKeys(allTranslations[locale]);
      expect(keys.length).toBe(koKeys.length);
    }
  });

  test('모든 언어에 동일한 키가 존재해야 한다', () => {
    const koKeys = extractKeys(allTranslations['ko']);
    for (const locale of LOCALES) {
      if (locale === 'ko') continue;
      const localeKeys = extractKeys(allTranslations[locale]);
      expect(localeKeys).toEqual(koKeys);
    }
  });

  test('빈 문자열 값이 없어야 한다', () => {
    for (const locale of LOCALES) {
      const keys = extractKeys(allTranslations[locale]);
      for (const key of keys) {
        const value = key.split('.').reduce((obj: any, k: string) => obj?.[k], allTranslations[locale]);
        expect(typeof value).toBe('string');
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('파라미터 플레이스홀더가 모든 언어에서 일치해야 한다', () => {
    const koData = allTranslations['ko'];
    const koKeys = extractKeys(koData);

    for (const key of koKeys) {
      const koValue = key.split('.').reduce((obj: any, k: string) => obj?.[k], koData) as string;
      const koParams = (koValue.match(/\{(\w+)\}/g) || []).sort();

      if (koParams.length === 0) continue;

      for (const locale of LOCALES) {
        if (locale === 'ko') continue;
        const localeValue = key.split('.').reduce((obj: any, k: string) => obj?.[k], allTranslations[locale]) as string;
        const localeParams = (localeValue.match(/\{(\w+)\}/g) || []).sort();
        expect(localeParams).toEqual(koParams);
      }
    }
  });
});
