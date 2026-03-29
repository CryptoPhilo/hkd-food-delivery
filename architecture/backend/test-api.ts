import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAPI() {
  console.log('\n========================================');
  console.log('   API 테스트');
  console.log('========================================\n');

  console.log('📋 Test 1: 식당 목록 조회');
  const restaurants = await prisma.restaurant.findMany({
    include: { menus: true },
    take: 3,
  });
  
  console.log(`   ✅ 성공: ${restaurants.length}개 식당 조회`);
  restaurants.forEach(r => {
    console.log(`      - ${r.name} (메뉴 ${r.menus.length}개)`);
  });

  if (restaurants.length > 0) {
    console.log('\n📋 Test 2: 특정 식당 조회');
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurants[0].id },
      include: { menus: true },
    });
    console.log(`   ✅ 성공: ${restaurant?.name}`);
    console.log(`      주소: ${restaurant?.address}`);
    console.log(`      전화: ${restaurant?.phone}`);
    console.log(`      메뉴:`);
    restaurant?.menus.forEach(m => {
      console.log(`        - ${m.name}: ${m.price}원`);
    });
  }

  if (restaurants.length > 0) {
    console.log('\n📋 Test 3: 식당 활성화 토글');
    const updated = await prisma.restaurant.update({
      where: { id: restaurants[0].id },
      data: { isActive: !restaurants[0].isActive },
    });
    console.log(`   ✅ 성공: ${updated.name} -> isActive: ${updated.isActive}`);
    
    await prisma.restaurant.update({
      where: { id: restaurants[0].id },
      data: { isActive: restaurants[0].isActive },
    });
  }

  if (restaurants.length > 0 && restaurants[0].menus.length > 0) {
    console.log('\n📋 Test 4: 메뉴 활성화 토글');
    const menu = restaurants[0].menus[0];
    const updated = await prisma.menu.update({
      where: { id: menu.id },
      data: { isAvailable: !menu.isAvailable },
    });
    console.log(`   ✅ 성공: ${updated.name} -> isAvailable: ${updated.isAvailable}`);
    
    await prisma.menu.update({
      where: { id: menu.id },
      data: { isAvailable: menu.isAvailable },
    });
  }

  if (restaurants.length > 0) {
    console.log('\n📋 Test 5: 메뉴 추가');
    const newMenu = await prisma.menu.create({
      data: {
        restaurantId: restaurants[0].id,
        name: '테스트 메뉴',
        description: '테스트용 메뉴입니다',
        price: 10000,
        isAvailable: true,
        isActive: true,
      },
    });
    console.log(`   ✅ 성공: ${newMenu.name} 추가 (ID: ${newMenu.id})`);
    
    await prisma.menu.delete({ where: { id: newMenu.id } });
    console.log(`   🧹 테스트 메뉴 삭제 완료`);
  }

  console.log('\n📋 Test 6: 식당 검색 (흑돼지)');
  const searchResults = await prisma.restaurant.findMany({
    where: {
      name: { contains: '흑돼지' },
    },
  });
  console.log(`   ✅ 성공: ${searchResults.length}개 검색됨`);
  searchResults.forEach(r => console.log(`      - ${r.name}`));

  console.log('\n📋 Test 7: 배달 가능 식당 조회');
  const deliverable = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      isDeliverable: true,
    },
  });
  console.log(`   ✅ 성공: ${deliverable.length}개 식당 배달 가능`);

  console.log('\n📋 Test 8: 식당 통계');
  const [total, active, deliverableCount] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { isActive: true } }),
    prisma.restaurant.count({ where: { isDeliverable: true } }),
  ]);
  console.log(`   ✅ 총 식당: ${total}개`);
  console.log(`   ✅ 활성 식당: ${active}개`);
  console.log(`   ✅ 배달 가능: ${deliverableCount}개`);

  console.log('\n========================================');
  console.log('   모든 테스트 완료!');
  console.log('========================================\n');
}

testAPI()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
