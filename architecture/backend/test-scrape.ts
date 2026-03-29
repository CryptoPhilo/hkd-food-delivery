import axios from 'axios';

const NAVER_CLIENT_ID = 'test_client_id';
const NAVER_CLIENT_SECRET = 'test_client_secret';

interface NaverPlace {
  id: string;
  name: string;
  address: string;
  roadAddress: string | null;
  mapx: string;
  mapy: string;
  category: string;
}

interface NaverSearchResult {
  items: NaverPlace[];
  total: number;
}

async function searchPlaces(query: string, display: number = 30): Promise<NaverSearchResult> {
  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/local.json', {
      params: {
        query,
        display,
        start: 1,
        sort: 'sim',
      },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
    });

    return {
      items: response.data.items.map((item: any) => ({
        id: item.roadAddress || item.address,
        name: item.title.replace(/<[^>]*>/g, ''),
        address: item.address,
        roadAddress: item.roadAddress || null,
        mapx: item.mapx,
        mapy: item.mapy,
        category: item.category,
      })),
      total: response.data.total,
    };
  } catch (error: any) {
    console.error('Naver API Error:', error.response?.data || error.message);
    throw error;
  }
}

async function getPlaceMenuInfo(name: string): Promise<string | null> {
  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/local.json', {
      params: {
        query: `${name} 메뉴`,
        display: 1,
      },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
    });
    
    return response.data.items?.[0]?.description || null;
  } catch {
    return null;
  }
}

async function main() {
  const area = '제주시 한경면';
  
  console.log(`\n=== ${area} 음식점 데이터 수집 테스트 ===\n`);
  
  const result = await searchPlaces(area, 20);
  
  console.log(`📍 검색 결과: ${result.total}개`);
  console.log(`📋 수신 데이터: ${result.items.length}개\n`);
  
  console.log('--- 음식점 목록 ---');
  
  for (let i = 0; i < result.items.length; i++) {
    const place = result.items[i];
    const lat = parseInt(place.mapy) / 10000000;
    const lng = parseInt(place.mapx) / 10000000;
    
    console.log(`\n[${i + 1}] ${place.name}`);
    console.log(`   📍 주소: ${place.address}`);
    console.log(`   📍 도로명: ${place.roadAddress || 'N/A'}`);
    console.log(`   📊 카테고리: ${place.category}`);
    console.log(`   🌐 좌표: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    const isRestaurant = place.category.includes('음식점') || 
                          place.category.includes('식당') ||
                          place.category.includes('고기') ||
                          place.category.includes('횟집') ||
                          place.category.includes('중식') ||
                          place.category.includes('일식') ||
                          place.category.includes('한식') ||
                          place.category.includes('분식') ||
                          place.category.includes('치킨') ||
                          place.category.includes('피자') ||
                          place.category.includes('카페');
    
    console.log(`   🍽️ 음식점 여부: ${isRestaurant ? '✅ 예' : '❌ 아니오'}`);
  }
  
  console.log('\n=== 수집 완료 ===\n');
}

main().catch(console.error);
