import fs from 'fs';
import path from 'path';

interface Menu {
  name: string;
  price: number;
  description?: string;
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  road_address: string;
  latitude: number;
  longitude: number;
  category: string;
  category_group: string;
  phone: string;
  place_url: string;
  rating: number;
  business_status: string;
  business_hours: string;
  description: string;
  is_active: boolean;
  is_deliverable: boolean;
  menus: Menu[];
}

interface DataFile {
  collection_info: {
    area: string;
    collected_at: string;
    source: string;
    total_restaurants: number;
  };
  restaurants: Restaurant[];
}

const DATA_FILE = path.join(__dirname, 'data', 'jeju-hangyeong-restaurants.json');

async function loadData(): Promise<DataFile> {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

async function importToDatabase() {
  console.log('\n========================================');
  console.log('   제주시 한경면 식당 데이터 Import');
  console.log('========================================\n');

  const data = await loadData();

  console.log(`📍 수집 지역: ${data.collection_info.area}`);
  console.log(`📅 수집 일시: ${data.collection_info.collected_at}`);
  console.log(`📊 총 식당: ${data.restaurants.length}개\n`);

  console.log('━'.repeat(50));

  let successCount = 0;
  let failCount = 0;

  for (const restaurant of data.restaurants) {
    try {
      console.log(`\n🏪 [${successCount + failCount + 1}] ${restaurant.name}`);
      console.log(`   ├─ 📍 주소: ${restaurant.address}`);
      console.log(`   ├─ 📞 전화: ${restaurant.phone}`);
      console.log(`   ├─ ⭐ 평점: ${restaurant.rating}`);
      console.log(`   ├─ 🔔 상태: ${restaurant.business_status === 'open' ? '✅ 영업중' : '❌ 휴업'}`);
      console.log(`   ├─ 🕐 시간: ${restaurant.business_hours}`);
      console.log(`   ├─ 🚚 배달: ${restaurant.is_deliverable ? '✅ 가능' : '❌ 불가'}`);
      console.log(`   └─ 🍽️ 메뉴: ${restaurant.menus.length}개`);

      restaurant.menus.forEach((menu, idx) => {
        console.log(`       ${idx + 1}. ${menu.name} - ${menu.price.toLocaleString()}원`);
      });

      successCount++;
    } catch (error) {
      console.log(`   ❌ 오류: ${error}`);
      failCount++;
    }
  }

  console.log('\n━'.repeat(50));
  console.log(`\n📈 요약:`);
  console.log(`   ✅ 성공: ${successCount}개`);
  console.log(`   ❌ 실패: ${failCount}개`);
  console.log(`   📊 총계: ${data.restaurants.length}개`);

  console.log('\n🎯 DB Insert용 SQL:');
  console.log('-- Restaurants');
  data.restaurants.forEach(r => {
    console.log(`INSERT INTO restaurants (name, address, road_address, latitude, longitude, category, phone, rating, is_active, is_deliverable) VALUES ('${r.name}', '${r.address}', '${r.road_address}', ${r.latitude}, ${r.longitude}, '${r.category}', '${r.phone}', ${r.rating}, ${r.is_active}, ${r.is_deliverable});`);
  });

  console.log('\n========================================');
  console.log('   Import 준비 완료!');
  console.log('========================================\n');
}

importToDatabase().catch(console.error);
