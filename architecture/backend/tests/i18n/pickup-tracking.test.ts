/**
 * 복수 식당 픽업 추적 기능 테스트
 * - 백엔드 i18n SMS 템플릿 (partialPickup, allPickedUp)
 * - 배달 그룹 관련 로직
 */

import { t, isValidLocale } from '../../src/i18n';
import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['ko', 'en', 'ja', 'zh', 'fr', 'de', 'es'];

// ── 식당별 픽업 SMS 템플릿 ──

describe('식당별 픽업 SMS 템플릿', () => {
  describe('partialPickup — 중간 단계 픽업', () => {
    test.each(LOCALES)('%s — partialPickup 키가 존재하고 비어있지 않아야 한다', (locale) => {
      const result = t(locale, 'sms.partialPickup');
      expect(result).not.toBe('sms.partialPickup'); // 키 자체가 반환되면 번역 없음
      expect(result.length).toBeGreaterThan(0);
    });

    test.each(LOCALES)('%s — partialPickup에 모든 파라미터가 치환되어야 한다', (locale) => {
      const result = t(locale, 'sms.partialPickup', {
        restaurantName: '치킨집',
        pickedUp: '2',
        total: '3',
      });
      expect(result).toContain('치킨집');
      expect(result).toContain('2');
      expect(result).toContain('3');
      expect(result).not.toContain('{restaurantName}');
      expect(result).not.toContain('{pickedUp}');
      expect(result).not.toContain('{total}');
    });

    test.each(LOCALES)('%s — partialPickupRemaining 키가 존재해야 한다', (locale) => {
      const result = t(locale, 'sms.partialPickupRemaining', { remaining: '1' });
      expect(result).not.toBe('sms.partialPickupRemaining');
      expect(result).toContain('1');
      expect(result).not.toContain('{remaining}');
    });
  });

  describe('allPickedUp — 전체 픽업 완료', () => {
    test.each(LOCALES)('%s — allPickedUp 키가 존재해야 한다', (locale) => {
      const result = t(locale, 'sms.allPickedUp', { total: '3' });
      expect(result).not.toBe('sms.allPickedUp');
      expect(result).toContain('3');
      expect(result).not.toContain('{total}');
    });

    test.each(LOCALES)('%s — allPickedUpDelivery 키가 존재해야 한다', (locale) => {
      const result = t(locale, 'sms.allPickedUpDelivery');
      expect(result).not.toBe('sms.allPickedUpDelivery');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

// ── 번역 키 완전성 검증 ──

describe('백엔드 픽업 추적 번역 키 완전성', () => {
  const newKeys = [
    'sms.partialPickup',
    'sms.partialPickupRemaining',
    'sms.allPickedUp',
    'sms.allPickedUpDelivery',
  ];

  test('새 키가 모든 언어에 존재해야 한다', () => {
    for (const locale of LOCALES) {
      for (const key of newKeys) {
        const result = t(locale, key);
        // 키 자체가 반환되면 번역이 없는 것
        expect(result).not.toBe(key);
      }
    }
  });

  test('파라미터 플레이스홀더가 모든 언어에서 일치해야 한다', () => {
    const messagesDir = path.resolve(__dirname, '../../src/i18n/messages');

    const allTranslations: Record<string, any> = {};
    for (const locale of LOCALES) {
      allTranslations[locale] = JSON.parse(
        fs.readFileSync(path.join(messagesDir, `${locale}.json`), 'utf-8')
      );
    }

    // partialPickup은 {restaurantName}, {pickedUp}, {total}을 가져야 함
    for (const locale of LOCALES) {
      const val = allTranslations[locale].sms.partialPickup;
      expect(val).toContain('{restaurantName}');
      expect(val).toContain('{pickedUp}');
      expect(val).toContain('{total}');
    }

    // partialPickupRemaining은 {remaining}을 가져야 함
    for (const locale of LOCALES) {
      const val = allTranslations[locale].sms.partialPickupRemaining;
      expect(val).toContain('{remaining}');
    }

    // allPickedUp은 {total}을 가져야 함
    for (const locale of LOCALES) {
      const val = allTranslations[locale].sms.allPickedUp;
      expect(val).toContain('{total}');
    }
  });
});

// ── SMS 조합 시나리오 ──

describe('SMS 조합 시나리오', () => {
  test('중간 픽업 SMS 전문이 올바르게 조합되어야 한다 (ko)', () => {
    const brand = t('ko', 'sms.brandPrefix');
    const line1 = t('ko', 'sms.partialPickup', {
      restaurantName: '치킨집',
      pickedUp: '2',
      total: '3',
    });
    const line2 = t('ko', 'sms.partialPickupRemaining', { remaining: '1' });
    const fullMessage = `${brand} ${line1}\n${line2}`;

    expect(fullMessage).toContain('[한경배달]');
    expect(fullMessage).toContain('치킨집');
    expect(fullMessage).toContain('2/3');
    expect(fullMessage).toContain('1');
  });

  test('전체 픽업 완료 SMS 전문이 올바르게 조합되어야 한다 (en)', () => {
    const brand = t('en', 'sms.brandPrefix');
    const line1 = t('en', 'sms.allPickedUp', { total: '3' });
    const line2 = t('en', 'sms.allPickedUpDelivery');
    const fullMessage = `${brand} ${line1}\n${line2}`;

    expect(fullMessage).toContain('[HKD]');
    expect(fullMessage).toContain('3/3');
    expect(fullMessage).toContain('Delivery');
  });

  test('모든 언어에서 브랜드 프리픽스가 메시지에 포함되어야 한다', () => {
    for (const locale of LOCALES) {
      const brand = t(locale, 'sms.brandPrefix');
      expect(brand.length).toBeGreaterThan(0);
      expect(brand).toMatch(/^\[.+\]$/); // [HKD] or [한경배달] 형식
    }
  });
});
