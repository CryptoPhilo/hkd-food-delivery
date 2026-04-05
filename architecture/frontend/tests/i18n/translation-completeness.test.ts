/**
 * 프론트엔드 i18n 번역 키 완전성 테스트
 *
 * Node.js 스크립트로 실행 (ts-node 또는 tsx):
 *   npx tsx tests/i18n/translation-completeness.test.ts
 *
 * 검증 항목:
 *  1. 모든 언어 파일이 동일한 키 구조를 가지는지
 *  2. 누락된 키가 없는지
 *  3. 빈 문자열 값이 없는지
 *  4. 파라미터 플레이스홀더({param})가 일관되는지
 */

import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['ko', 'en', 'ja', 'zh', 'fr', 'de', 'es'];
const MESSAGES_DIR = path.resolve(__dirname, '../../src/i18n/messages');

// ── 유틸리티 함수 ──

/**
 * JSON 객체에서 모든 리프 키를 dot-notation 으로 추출
 */
function extractKeys(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

/**
 * 번역 문자열에서 파라미터 플레이스홀더를 추출 ({param} 형식)
 */
function extractParams(str: string): string[] {
  const matches = str.match(/\{(\w+)\}/g);
  return matches ? matches.sort() : [];
}

/**
 * 리프 노드의 값을 dot-notation 키로 가져오기
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// ── 테스트 실행 ──

interface TestResult {
  name: string;
  passed: boolean;
  details?: string[];
}

const results: TestResult[] = [];

function test(name: string, fn: () => { passed: boolean; details?: string[] }) {
  const result = fn();
  results.push({ name, ...result });
}

// 번역 파일 로드
const translations: Record<string, any> = {};
for (const locale of LOCALES) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 번역 파일 미발견: ${filePath}`);
    process.exit(1);
  }
  translations[locale] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// 기준 키 셋 (한국어 기준)
const referenceKeys = extractKeys(translations['ko']);

// ── Test 1: 모든 언어의 키 수 일치 확인 ──
test('모든 언어 파일의 키 수가 동일해야 한다', () => {
  const details: string[] = [];
  let passed = true;

  for (const locale of LOCALES) {
    const keys = extractKeys(translations[locale]);
    if (keys.length !== referenceKeys.length) {
      passed = false;
      details.push(`${locale}: ${keys.length}개 (기준: ${referenceKeys.length}개)`);
    }
  }

  return { passed, details: passed ? [`전 언어 ${referenceKeys.length}개 키 일치`] : details };
});

// ── Test 2: 누락된 키 확인 ──
test('각 언어에 누락된 키가 없어야 한다', () => {
  const details: string[] = [];
  let passed = true;

  for (const locale of LOCALES) {
    if (locale === 'ko') continue; // 기준 언어 제외
    const localeKeys = new Set(extractKeys(translations[locale]));
    const missingKeys = referenceKeys.filter(k => !localeKeys.has(k));

    if (missingKeys.length > 0) {
      passed = false;
      details.push(`${locale} 누락 (${missingKeys.length}개): ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`);
    }
  }

  if (passed) details.push('전 언어 키 누락 없음');
  return { passed, details };
});

// ── Test 3: 초과 키 확인 (기준 언어에 없는 키) ──
test('기준 언어(ko)에 없는 키가 다른 언어에 존재하지 않아야 한다', () => {
  const details: string[] = [];
  let passed = true;
  const referenceKeySet = new Set(referenceKeys);

  for (const locale of LOCALES) {
    if (locale === 'ko') continue;
    const localeKeys = extractKeys(translations[locale]);
    const extraKeys = localeKeys.filter(k => !referenceKeySet.has(k));

    if (extraKeys.length > 0) {
      passed = false;
      details.push(`${locale} 초과 (${extraKeys.length}개): ${extraKeys.slice(0, 5).join(', ')}`);
    }
  }

  if (passed) details.push('초과 키 없음');
  return { passed, details };
});

// ── Test 4: 빈 문자열 값 확인 ──
test('번역 값이 빈 문자열이 아니어야 한다', () => {
  const details: string[] = [];
  let passed = true;

  for (const locale of LOCALES) {
    const emptyKeys: string[] = [];
    for (const key of referenceKeys) {
      const value = getNestedValue(translations[locale], key);
      if (typeof value === 'string' && value.trim() === '') {
        emptyKeys.push(key);
      }
    }

    if (emptyKeys.length > 0) {
      passed = false;
      details.push(`${locale} 빈 값 (${emptyKeys.length}개): ${emptyKeys.slice(0, 5).join(', ')}`);
    }
  }

  if (passed) details.push('빈 문자열 없음');
  return { passed, details };
});

// ── Test 5: 파라미터 플레이스홀더 일관성 확인 ──
test('파라미터 플레이스홀더({param})가 모든 언어에서 일치해야 한다', () => {
  const details: string[] = [];
  let passed = true;

  for (const key of referenceKeys) {
    const koValue = getNestedValue(translations['ko'], key);
    if (typeof koValue !== 'string') continue;

    const koParams = extractParams(koValue);
    if (koParams.length === 0) continue; // 파라미터 없는 키는 건너뜀

    for (const locale of LOCALES) {
      if (locale === 'ko') continue;
      const localeValue = getNestedValue(translations[locale], key);
      if (typeof localeValue !== 'string') continue;

      const localeParams = extractParams(localeValue);
      const koSet = new Set(koParams);
      const localeSet = new Set(localeParams);

      // 한국어 키의 파라미터가 다른 언어에도 모두 존재해야 함
      const missing = koParams.filter(p => !localeSet.has(p));
      if (missing.length > 0) {
        passed = false;
        details.push(`${locale}/${key}: 파라미터 누락 ${missing.join(', ')}`);
      }
    }
  }

  if (passed) details.push('파라미터 일관성 확인 완료');
  return { passed, details };
});

// ── Test 6: 필수 섹션 존재 확인 ──
test('필수 번역 섹션이 모든 언어에 존재해야 한다', () => {
  const requiredSections = [
    'common', 'home', 'restaurant', 'store', 'checkout',
    'checkoutComplete', 'confirm', 'cancel', 'myOrders',
    'orderDetail', 'orderStatus', 'foodCategory', 'footer',
    'language', 'phone', 'sms',
  ];

  const details: string[] = [];
  let passed = true;

  for (const locale of LOCALES) {
    const missingSections = requiredSections.filter(s => !translations[locale][s]);
    if (missingSections.length > 0) {
      passed = false;
      details.push(`${locale} 섹션 누락: ${missingSections.join(', ')}`);
    }
  }

  if (passed) details.push(`필수 ${requiredSections.length}개 섹션 확인 완료`);
  return { passed, details };
});

// ── Test 7: 통화 기호 일관성 (₩ 사용 확인) ──
test('통화 관련 번역에서 ₩ 기호를 사용해야 한다', () => {
  const currencyKeys = [
    'checkout.payButton',
    'checkout.foodAmount',
    'checkout.deliveryFee',
    'checkout.totalAmount',
  ];

  const details: string[] = [];
  let passed = true;

  // payButton은 ₩ 를 포함해야 함
  for (const locale of LOCALES) {
    const payButton = getNestedValue(translations[locale], 'checkout.payButton');
    if (typeof payButton === 'string' && !payButton.includes('₩')) {
      passed = false;
      details.push(`${locale}/checkout.payButton: ₩ 기호 미포함 — "${payButton}"`);
    }
  }

  if (passed) details.push('통화 기호 일관성 확인 완료');
  return { passed, details };
});

// ── 결과 출력 ──
console.log('\n====================================');
console.log('  프론트엔드 i18n 번역 완전성 테스트');
console.log('====================================\n');

let allPassed = true;
for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  console.log(`${icon} ${r.name}`);
  if (r.details) {
    for (const d of r.details) {
      console.log(`   ${r.passed ? '→' : '⚠️'} ${d}`);
    }
  }
  if (!r.passed) allPassed = false;
}

console.log(`\n총 ${results.length}개 테스트, 통과: ${results.filter(r => r.passed).length}, 실패: ${results.filter(r => !r.passed).length}`);

if (!allPassed) {
  console.log('\n❌ 일부 테스트 실패\n');
  process.exit(1);
} else {
  console.log('\n✅ 모든 테스트 통과\n');
}
