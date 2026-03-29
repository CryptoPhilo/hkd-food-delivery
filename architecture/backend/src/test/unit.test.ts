import { calculateDistance, calculateDeliveryFee, estimateDeliveryTime, calculateDeliveryInfo } from '../utils/haversine';

console.log('=== 단위 테스트: 배달비 계산 ===\n');

console.log('테스트 1:近距离 (1km 이내)');
const result1 = calculateDeliveryInfo(37.497942, 127.027621, 37.5050, 127.0250);
console.log(`  거리: ${result1.distance}km`);
console.log(`  배달비: ${result1.deliveryFee}원`);
console.log(`  예상 시간: ${result1.totalEstimatedTime}분`);
console.log(`  결과: ${result1.isDeliverable ? '배달 가능' : '배달 불가'}`);
console.log(`  예상: distance≈0.8km, fee=3000원, time≈21분`);
console.log('');

console.log('테스트 2:中距離 (2km 초과 3km 미만)');
const result2 = calculateDeliveryInfo(37.497942, 127.027621, 37.5200, 127.0200);
console.log(`  거리: ${result2.distance}km`);
console.log(`  배달비: ${result2.deliveryFee}원`);
console.log(`  예상 시간: ${result2.totalEstimatedTime}분`);
console.log(`  결과: ${result2.isDeliverable ? '배달 가능' : '배달 불가'}`);
console.log('');

console.log('테스트 3:遠距離 (5km 초과)');
const result3 = calculateDeliveryInfo(37.497942, 127.027621, 37.5500, 127.0500);
console.log(`  거리: ${result3.distance}km`);
console.log(`  배달비: ${result3.deliveryFee}원`);
console.log(`  예상 시간: ${result3.totalEstimatedTime}분`);
console.log(`  결과: ${result3.isDeliverable ? '배달 가능' : '배달 불가'}`);
console.log(`  예상: distance≈7km, fee=0원 (배달 불가), time=0분`);
console.log('');

console.log('=== 테스트 결과 요약 ===');
console.log(`테스트 1: ${result1.isDeliverable && result1.deliveryFee === 3000 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`테스트 2: ${result2.isDeliverable && result2.deliveryFee === 3000 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`테스트 3: ${!result3.isDeliverable && result3.deliveryFee === 0 ? '✅ PASS' : '❌ FAIL'}`);
