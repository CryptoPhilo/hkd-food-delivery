/**
 * 프론트엔드 i18n config 모듈 테스트
 *
 * 실행: npx tsx tests/i18n/config.test.ts
 */

import {
  locales,
  defaultLocale,
  localeNames,
  PORTONE_LOCALE_MAP,
  getPortOneLocale,
  LOCALE_TO_COUNTRY,
  PRIORITY_COUNTRIES,
  LOCALE_FLAGS,
} from '../../src/i18n/config';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => boolean, details?: string) {
  const passed = fn();
  results.push({ name, passed, details: passed ? undefined : details });
}

// ── Test 1: locales 배열 ──
test('locales 배열이 7개 언어를 포함해야 한다', () => {
  return locales.length === 7 &&
    locales.includes('ko') &&
    locales.includes('en') &&
    locales.includes('ja') &&
    locales.includes('zh') &&
    locales.includes('fr') &&
    locales.includes('de') &&
    locales.includes('es');
}, `실제: ${JSON.stringify(locales)}`);

// ── Test 2: defaultLocale ──
test('기본 locale이 영어(en)여야 한다', () => {
  return defaultLocale === 'en';
}, `실제: ${defaultLocale}`);

// ── Test 3: localeNames ──
test('모든 locale에 대한 이름이 정의되어 있어야 한다', () => {
  return locales.every(l => typeof localeNames[l] === 'string' && localeNames[l].length > 0);
});

// ── Test 4: PortOne locale 매핑 ──
test('모든 locale에 PortOne locale이 매핑되어 있어야 한다', () => {
  return locales.every(l => typeof PORTONE_LOCALE_MAP[l] === 'string');
});

test('PortOne locale 형식이 XX_XX여야 한다', () => {
  return Object.values(PORTONE_LOCALE_MAP).every(v => /^[A-Z]{2}_[A-Z]{2}$/.test(v));
}, `실제: ${JSON.stringify(PORTONE_LOCALE_MAP)}`);

// ── Test 5: getPortOneLocale 함수 ──
test('getPortOneLocale("ko")가 "KO_KR"을 반환해야 한다', () => {
  return getPortOneLocale('ko') === 'KO_KR';
});

test('getPortOneLocale("en")이 "EN_US"를 반환해야 한다', () => {
  return getPortOneLocale('en') === 'EN_US';
});

test('미지원 locale에 대해 "EN_US"로 폴백해야 한다', () => {
  return getPortOneLocale('ar') === 'EN_US' &&
    getPortOneLocale('') === 'EN_US' &&
    getPortOneLocale('xx') === 'EN_US';
});

// ── Test 6: LOCALE_TO_COUNTRY 매핑 ──
test('모든 locale에 국가 코드가 매핑되어 있어야 한다', () => {
  return locales.every(l => typeof LOCALE_TO_COUNTRY[l] === 'string' && LOCALE_TO_COUNTRY[l].length === 2);
});

test('한국어 locale이 KR 국가에 매핑되어야 한다', () => {
  return LOCALE_TO_COUNTRY['ko'] === 'KR';
});

// ── Test 7: PRIORITY_COUNTRIES ──
test('PRIORITY_COUNTRIES가 7개 국가를 포함해야 한다', () => {
  return PRIORITY_COUNTRIES.length === 7 &&
    PRIORITY_COUNTRIES.includes('KR') &&
    PRIORITY_COUNTRIES.includes('US');
});

// ── Test 8: LOCALE_FLAGS ──
test('모든 locale에 국기 이모지가 매핑되어 있어야 한다', () => {
  return locales.every(l => typeof LOCALE_FLAGS[l] === 'string' && LOCALE_FLAGS[l].length > 0);
});

test('한국어 국기가 🇰🇷여야 한다', () => {
  return LOCALE_FLAGS['ko'] === '🇰🇷';
});

// ── 결과 출력 ──
console.log('\n====================================');
console.log('  프론트엔드 i18n config 테스트');
console.log('====================================\n');

let allPassed = true;
for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  console.log(`${icon} ${r.name}${r.details ? ` (${r.details})` : ''}`);
  if (!r.passed) allPassed = false;
}

console.log(`\n총 ${results.length}개 테스트, 통과: ${results.filter(r => r.passed).length}, 실패: ${results.filter(r => !r.passed).length}`);

if (!allPassed) {
  console.log('\n❌ 일부 테스트 실패\n');
  process.exit(1);
} else {
  console.log('\n✅ 모든 테스트 통과\n');
}
