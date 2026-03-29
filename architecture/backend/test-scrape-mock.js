const MOCK_RESTAURANTS = [
  {
    id: 'jeju_hangyeong_001',
    name: '한경면 본점',
    address: '제주특별자치도 제주시 한경면 한경로 123',
    roadAddress: '제주특별자치도 제주시 한경면 한경로 123',
    latitude: 33.3617,
    longitude: 126.3100,
    category: '음식점 > 한식 > 고기',
    businessStatus: 'open',
    rating: 4.5,
    phone: '064-123-4567',
    menus: [
      { name: '흑돼지살치살', price: 25000, description: '제주 흑돼지 살치살 200g' },
      { name: '흑돼지목살', price: 22000, description: '제주 흑돼지 목살 200g' },
      { name: '흑돼지김치찌개', price: 12000, description: '제주风味 김치찌개' },
    ]
  },
  {
    id: 'jeju_hangyeong_002',
    name: '해녀들의 밥상',
    address: '제주특별자치도 제주시 한경면 금등리 456',
    roadAddress: '제주특별자치도 제주시 한경면 금등리 456',
    latitude: 33.3550,
    longitude: 126.3050,
    category: '음식점 > 한식 > 횟집',
    businessStatus: 'open',
    rating: 4.8,
    phone: '064-234-5678',
    menus: [
      { name: '특선 회덮밥', price: 18000, description: '횟감채와 특製 소스' },
      { name: '해산물탕', price: 25000, description: '제주 해산물 매운탕' },
      { name: '소금구이', price: 35000, description: '天然 岩盐 구이' },
    ]
  },
  {
    id: 'jeju_hangyeong_003',
    name: '용두암식당',
    address: '제주특별자치도 제주시 한경면 용두암로 789',
    roadAddress: '제주특별자치도 제주시 한경면 용두암로 789',
    latitude: 33.3700,
    longitude: 126.3200,
    category: '음식점 > 한식 >횟집',
    businessStatus: 'open',
    rating: 4.3,
    phone: '064-345-6789',
    menus: [
      { name: '광어회', price: 35000, description: '天然 광어 3종' },
      { name: '우럭회', price: 40000, description: '天然 우럭 3종' },
      { name: '제주 해녀밥', price: 15000, description: '해녀들이 직접 조리' },
    ]
  },
  {
    id: 'jeju_hangyeong_004',
    name: '카페 한경',
    address: '제주특별자치도 제주시 한경면 노루내로 101',
    roadAddress: '제주특별자치도 제주시 한경면 노루내로 101',
    latitude: 33.3580,
    longitude: 126.3080,
    category: '음식점 > 카페 > 디저트',
    businessStatus: 'open',
    rating: 4.6,
    phone: '064-456-7890',
    menus: [
      { name: '제주 녹차 라떼', price: 5500, description: '제주산 녹차' },
      { name: '한라산 케이크', price: 6500, description: '수제 케이크' },
      { name: '아메리카노', price: 4000, description: '원두埃塞俄比亚' },
    ]
  },
  {
    id: 'jeju_hangyeong_005',
    name: '서귀포_TIMESTAMP',
    address: '제주특별자치도 제주시 한경면Timer 999',
    roadAddress: null,
    latitude: 33.3650,
    longitude: 126.3150,
    category: '음식점 > 중식',
    businessStatus: 'closed',
    rating: 4.0,
    phone: '064-567-8901',
    menus: [
      { name: '짜장면', price: 8000, description: '伝統的手工面条' },
      { name: '탕수육', price: 18000, description: '豚肉类' },
    ]
  }
];

console.log('\n========================================');
console.log('   제주시 한경면 음식점 데이터 수집 시뮬레이션');
console.log('========================================\n');

console.log(`📍 수집 지역: 제주특별자치도 제주시 한경면`);
console.log(`📅 수집 일시: ${new Date().toLocaleString('ko-KR')}`);
console.log(`📊 수집 대상: ${MOCK_RESTAURANTS.length}개 식당\n`);

console.log('━'.repeat(50));

let openCount = 0;
let closedCount = 0;

MOCK_RESTAURANTS.forEach((restaurant, index) => {
  const isOpen = restaurant.businessStatus === 'open';
  
  if (isOpen) openCount++;
  else closedCount++;
  
  console.log(`\n🏪 [${index + 1}] ${restaurant.name}`);
  console.log(`   ├─ 📍 주소: ${restaurant.address}`);
  console.log(`   ├─ 📞 전화: ${restaurant.phone || 'N/A'}`);
  console.log(`   ├─ 📊 카테고리: ${restaurant.category}`);
  console.log(`   ├─ ⭐ 평점: ${restaurant.rating || 'N/A'}`);
  console.log(`   ├─ 🔔 영업상태: ${isOpen ? '✅ 영업중' : '❌ 휴업'}`);
  console.log(`   ├─ 🌐 좌표: (${restaurant.latitude}, ${restaurant.longitude})`);
  
  if (restaurant.menus && restaurant.menus.length > 0) {
    console.log(`   └─ 🍽️ 메뉴 (${restaurant.menus.length}개):`);
    restaurant.menus.forEach((menu, menuIndex) => {
      const available = isOpen ? '✅' : '❌';
      console.log(`       ${menuIndex + 1}. ${menu.name} - ${menu.price.toLocaleString()}원 ${available}`);
      if (menu.description) {
        console.log(`          └─ ${menu.description}`);
      }
    });
  } else {
    console.log(`   └─ 🍽️ 메뉴: 정보 없음`);
  }
  
  console.log('');
});

console.log('━'.repeat(50));

console.log(`\n📈 요약:`);
console.log(`   ✅ 영업중: ${openCount}개`);
console.log(`   ❌ 휴업: ${closedCount}개`);
console.log(`   📊 총계: ${MOCK_RESTAURANTS.length}개`);

console.log('\n🎯 데이터 구조 (저장용):');
console.log(JSON.stringify(MOCK_RESTAURANTS.map(r => ({
  naver_place_id: r.id,
  name: r.name,
  address: r.address,
  road_address: r.roadAddress,
  latitude: r.latitude,
  longitude: r.longitude,
  category: r.category,
  business_status: r.businessStatus,
  phone: r.phone,
  rating: r.rating,
  is_active: true,
  is_deliverable: true,
  menus: r.menus?.map(m => ({
    name: m.name,
    price: m.price,
    description: m.description,
    is_available: r.businessStatus === 'open'
  }))
})), null, 2));

console.log('\n========================================');
console.log('   테스트 완료!');
console.log('========================================\n');
