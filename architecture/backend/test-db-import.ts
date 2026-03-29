import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const DATA_FILE = path.join(__dirname, 'data', 'jeju-hangyeong-restaurants.json');

async function main() {
  console.log('\n========================================');
  console.log('   SQLite DB에 Mock 데이터 Import');
  console.log('========================================\n');

  if (!fs.existsSync(DATA_FILE)) {
    console.log('❌ 데이터 파일을 찾을 수 없습니다:', DATA_FILE);
    return;
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(rawData);

  console.log(`📍 수집 지역: ${data.collection_info.area}`);
  console.log(`📊 총 식당: ${data.restaurants.length}개\n`);

  let importCount = 0;
  let skipCount = 0;

  for (const restaurant of data.restaurants) {
    try {
      const existing = await prisma.restaurant.findFirst({
        where: { name: restaurant.name as any },
      });

      if (existing) {
        console.log(`   ⏭️  건너뜀: ${restaurant.name} (이미 존재)`);
        skipCount++;
        continue;
      }

      const created = await prisma.restaurant.create({
        data: {
          kakaoPlaceId: String(restaurant.id),
          name: restaurant.name,
          address: restaurant.address,
          roadAddress: restaurant.road_address || null,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          category: restaurant.category,
          phone: restaurant.phone,
          description: restaurant.description || null,
          businessStatus: restaurant.business_status,
          businessHours: restaurant.business_hours,
          isActive: restaurant.is_active,
          isDeliverable: restaurant.is_deliverable,
          rating: restaurant.rating,
          deliveryRadius: 3,
          menus: {
            create: restaurant.menus.map((m: any) => ({
              name: m.name,
              description: m.description || null,
              price: m.price,
              isAvailable: true,
              isActive: true,
            })),
          },
        },
      });

      console.log(`   ✅ 추가: ${restaurant.name} (메뉴 ${restaurant.menus.length}개)`);
      importCount++;
    } catch (error: any) {
      console.log(`   ❌ 오류: ${restaurant.name} - ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log('   Import 완료!');
  console.log('========================================');
  console.log(`   ✅ 성공: ${importCount}개`);
  console.log(`   ⏭️  건너뜀: ${skipCount}개`);
  console.log(`   📊 총계: ${importCount + skipCount}개\n`);

  const totalRestaurants = await prisma.restaurant.count();
  const totalMenus = await prisma.menu.count();
  console.log(`📈 DB 현황:`);
  console.log(`   식당: ${totalRestaurants}개`);
  console.log(`   메뉴: ${totalMenus}개\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
