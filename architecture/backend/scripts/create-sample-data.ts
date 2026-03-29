import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('샘플 데이터 생성 시작...');

  const restaurant1 = await prisma.restaurant.create({
    data: {
      name: '한경김밥',
      address: '제주특별자치도 제주시 한경면 한경로 123',
      latitude: 33.3615,
      longitude: 126.3098,
      phone: '064-123-4567',
      category: '음식점 > 한식 > 김밥',
      businessHours: '09:00-21:00',
      isActive: true,
      isDeliverable: true,
      deliveryRadius: 5.0,
    },
  });

  const restaurant2 = await prisma.restaurant.create({
    data: {
      name: '한경치킨',
      address: '제주특별자치도 제주시 한경면 한경로 456',
      latitude: 33.3620,
      longitude: 126.3100,
      phone: '064-234-5678',
      category: '음식점 > 치킨',
      businessHours: '11:00-23:00',
      isActive: true,
      isDeliverable: true,
      deliveryRadius: 5.0,
    },
  });

  console.log('식당 생성 완료');

  const menu1 = await prisma.menu.create({
    data: {
      restaurantId: restaurant1.id,
      name: '참치김밥',
      description: '신선한 참치와 야채가 들어간 김밥',
      price: 4500,
      isAvailable: true,
      isActive: true,
    },
  });

  const menu2 = await prisma.menu.create({
    data: {
      restaurantId: restaurant1.id,
      name: '라면',
      description: '얼큰한 라면',
      price: 5000,
      isAvailable: true,
      isActive: true,
    },
  });

  const menu3 = await prisma.menu.create({
    data: {
      restaurantId: restaurant2.id,
      name: '후라이드치킨',
      description: '바삭한 후라이드치킨',
      price: 18000,
      isAvailable: true,
      isActive: true,
    },
  });

  const menu4 = await prisma.menu.create({
    data: {
      restaurantId: restaurant2.id,
      name: '양념치킨',
      description: '달콤한 양념치킨',
      price: 19000,
      isAvailable: true,
      isActive: true,
    },
  });

  console.log('메뉴 생성 완료');

  const user1 = await prisma.user.create({
    data: {
      phone: '010-1111-2222',
      name: '김고객',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      phone: '010-3333-4444',
      name: '이고객',
    },
  });

  const user3 = await prisma.user.create({
    data: {
      phone: '010-5555-6666',
      name: '박고객',
    },
  });

  console.log('고객 생성 완료');

  const generateOrderNumber = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `ORD${date}${random}`;
  };

  await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: user1.id,
      restaurantId: restaurant1.id,
      status: 'order_confirmed',
      subtotal: 9500,
      deliveryFee: 3000,
      totalAmount: 12500,
      deliveryAddress: '제주시 한경면 신도리 123-45',
      deliveryLatitude: 33.3650,
      deliveryLongitude: 126.3150,
      customerMemo: '문 앞에 놔주세요',
      paymentStatus: 'paid',
      items: {
        create: [
          {
            menuId: menu1.id,
            menuName: '참치김밥',
            quantity: 1,
            unitPrice: 4500,
            subtotal: 4500,
          },
          {
            menuId: menu2.id,
            menuName: '라면',
            quantity: 1,
            unitPrice: 5000,
            subtotal: 5000,
          },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: user2.id,
      restaurantId: restaurant2.id,
      status: 'order_confirmed',
      subtotal: 37000,
      deliveryFee: 3500,
      totalAmount: 40500,
      deliveryAddress: '제주시 한경면 판포리 234-56',
      deliveryLatitude: 33.3700,
      deliveryLongitude: 126.3200,
      customerMemo: '벨 누르지 마세요. 전화주세요.',
      paymentStatus: 'paid',
      items: {
        create: [
          {
            menuId: menu3.id,
            menuName: '후라이드치킨',
            quantity: 1,
            unitPrice: 18000,
            subtotal: 18000,
          },
          {
            menuId: menu4.id,
            menuName: '양념치킨',
            quantity: 1,
            unitPrice: 19000,
            subtotal: 19000,
          },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: user3.id,
      restaurantId: restaurant1.id,
      status: 'order_confirmed',
      subtotal: 4500,
      deliveryFee: 3000,
      totalAmount: 7500,
      deliveryAddress: '제주시 한경면 고산리 345-67',
      deliveryLatitude: 33.3550,
      deliveryLongitude: 126.3050,
      paymentStatus: 'paid',
      items: {
        create: [
          {
            menuId: menu1.id,
            menuName: '참치김밥',
            quantity: 1,
            unitPrice: 4500,
            subtotal: 4500,
          },
        ],
      },
    },
  });

  console.log('대기 중인 주문 생성 완료');

  const driver = await prisma.driver.create({
    data: {
      phone: '010-9999-8888',
      name: '최배달',
      cardNumber: '1234-5678-9012',
      isOnDuty: false,
    },
  });

  console.log('배달원 생성 완료');

  console.log('\n=== 샘플 데이터 생성 완료 ===');
  console.log('\n테스트 방법:');
  console.log('1. http://localhost:3002/driver 접속');
  console.log('2. 전화번호 입력: 010-9999-8888');
  console.log('3. 업무 개시 버튼 클릭');
  console.log('4. 대기 중인 주문 확인 및 배정');
  console.log('5. 배정된 주문에서 완료 버튼 클릭');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
