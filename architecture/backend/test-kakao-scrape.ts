import axios from 'axios';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || '';

const AREA = '제주특별자치도 제주시 한경면';

async function searchRestaurants() {
  console.log('\n========================================');
  console.log('   Kakao Maps API - 제주시 한경면 음식점 수집');
  console.log('========================================\n');

  if (!KAKAO_REST_API_KEY || KAKAO_REST_API_KEY === 'your_kakao_rest_api_key_here') {
    console.log('⚠️  Kakao API Key가 설정되지 않았습니다.');
    console.log('   .env 파일에 KAKAO_REST_API_KEY를 설정해주세요.\n');
    console.log('   설정 방법:');
    console.log('   1. https://developers.kakao.com 접속');
    console.log('   2. 앱 생성 → JavaScript 키 또는 REST API 키 확인');
    console.log('   3. .env 파일에 KAKAO_REST_API_KEY=your_key 추가\n');
    
    console.log('--- Mock 데이터로 시뮬레이션 ---\n');
    return mockData();
  }

  try {
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: {
        query: `${AREA} 음식점`,
        category_group_code: 'FD6',
        size: 30,
      },
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
    });

    const data = response.data;
    console.log(`📍 검색어: ${AREA} 음식점`);
    console.log(`📊 총 결과: ${data.meta.total_count}개`);
    console.log(`📋 수신 데이터: ${data.documents.length}개\n`);

    console.log('━'.repeat(50));

    let openCount = 0;
    let closedCount = 0;

    data.documents.forEach((place: any, index: number) => {
      console.log(`\n🏪 [${index + 1}] ${place.place_name}`);
      console.log(`   ├─ 📍 주소: ${place.address_name}`);
      console.log(`   ├─ 📞 전화: ${place.phone || 'N/A'}`);
      console.log(`   ├─ 📊 카테고리: ${place.category_name}`);
      console.log(`   ├─ 🌐 좌표: (${place.y}, ${place.x})`);
      console.log(`   └─ 🔗 URL: ${place.place_url}`);
    });

    console.log('\n━'.repeat(50));
    console.log(`\n📈 요약:`);
    console.log(`   ✅ 총식당: ${data.documents.length}개`);

    console.log('\n🎯 데이터 구조 (저장용):');
    const saveData = data.documents.map((r: any) => ({
      kakao_place_id: r.id,
      name: r.place_name,
      address: r.address_name,
      road_address: r.road_address_name,
      latitude: parseFloat(r.y),
      longitude: parseFloat(r.x),
      category: r.category_name,
      phone: r.phone,
      is_active: true,
    }));
    console.log(JSON.stringify(saveData, null, 2));

    console.log('\n========================================');
    console.log('   수집 완료!');
    console.log('========================================\n');

  } catch (error: any) {
    console.error('❌ API 오류:', error.response?.data || error.message);
    console.log('\n--- Mock 데이터로 시뮬레이션 ---\n');
    mockData();
  }
}

function mockData() {
  const MOCK_RESTAURANTS = [
    {
      id: 1234567890,
      place_name: '한경면 본점',
      address_name: '제주특별자치도 제주시 한경면 한경로 123',
      road_address_name: '제주특별자치도 제주시 한경면 한경로 123',
      y: '33.3617',
      x: '126.3100',
      category_name: '음식점 > 한식 > 고기',
      category_group_name: '음식점',
      phone: '064-123-4567',
      place_url: 'https://place.map.kakao.com/1234567890',
    },
    {
      id: 1234567891,
      place_name: '해녀들의 밥상',
      address_name: '제주특별자치도 제주시 한경면 금등리 456',
      road_address_name: '제주특별자치도 제주시 한경면 금등리 456',
      y: '33.3550',
      x: '126.3050',
      category_name: '음식점 > 한식 > 횟집',
      category_group_name: '음식점',
      phone: '064-234-5678',
      place_url: 'https://place.map.kakao.com/1234567891',
    },
    {
      id: 1234567892,
      place_name: '용두암식당',
      address_name: '제주특별자치도 제주시 한경면 용두암로 789',
      road_address_name: '제주특별자치도 제주시 한경면 용두암로 789',
      y: '33.3700',
      x: '126.3200',
      category_name: '음식점 > 한식 > 횟집',
      category_group_name: '음식점',
      phone: '064-345-6789',
      place_url: 'https://place.map.kakao.com/1234567892',
    },
    {
      id: 1234567893,
      place_name: '카페 한경',
      address_name: '제주특별자치도 제주시 한경면 노루내로 101',
      road_address_name: '제주특별자치도 제주시 한경면 노루내로 101',
      y: '33.3580',
      x: '126.3080',
      category_name: '음식점 > 카페 > 디저트',
      category_group_name: '음식점',
      phone: '064-456-7890',
      place_url: 'https://place.map.kakao.com/1234567893',
    },
    {
      id: 1234567894,
      place_name: '서귀포 Timestamp',
      address_name: '제주특별자치도 제주시 한경면Timer 999',
      road_address_name: '',
      y: '33.3650',
      x: '126.3150',
      category_name: '음식점 > 중식',
      category_group_name: '음식점',
      phone: '064-567-8901',
      place_url: 'https://place.map.kakao.com/1234567894',
    },
  ];

  console.log(`📍 검색어: ${AREA} 음식점 (Mock)`);
  console.log(`📊 총 결과: ${MOCK_RESTAURANTS.length}개`);
  console.log(`📋 수신 데이터: ${MOCK_RESTAURANTS.length}개\n`);

  console.log('━'.repeat(50));

  MOCK_RESTAURANTS.forEach((place: any, index: number) => {
    console.log(`\n🏪 [${index + 1}] ${place.place_name}`);
    console.log(`   ├─ 📍 주소: ${place.address_name}`);
    console.log(`   ├─ 📞 전화: ${place.phone || 'N/A'}`);
    console.log(`   ├─ 📊 카테고리: ${place.category_name}`);
    console.log(`   ├─ 🌐 좌표: (${place.y}, ${place.x})`);
    console.log(`   └─ 🔗 URL: ${place.place_url}`);
  });

  console.log('\n━'.repeat(50));
  console.log(`\n📈 요약:`);
  console.log(`   ✅ 총식당: ${MOCK_RESTAURANTS.length}개`);

  console.log('\n🎯 데이터 구조 (저장용):');
  const saveData = MOCK_RESTAURANTS.map((r: any) => ({
    kakao_place_id: r.id,
    name: r.place_name,
    address: r.address_name,
    road_address: r.road_address_name || null,
    latitude: parseFloat(r.y),
    longitude: parseFloat(r.x),
    category: r.category_name,
    phone: r.phone,
    is_active: true,
  }));
  console.log(JSON.stringify(saveData, null, 2));

  console.log('\n========================================');
  console.log('   Mock 데이터 수집 완료!');
  console.log('========================================\n');
}

searchRestaurants();
