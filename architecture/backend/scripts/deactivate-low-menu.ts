/**
 * 메뉴가 1개 이하인 식당을 비활성화하는 스크립트
 * 실행: npx tsx scripts/deactivate-low-menu.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 모든 식당과 메뉴 수 조회
  const restaurants = await prisma.restaurant.findMany({
    include: {
      _count: {
        select: { menus: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`\n총 ${restaurants.length}개 식당 조회\n`);
  console.log(`${'식당명'.padEnd(30)} ${'메뉴수'.padStart(5)} ${'현재상태'.padStart(8)}`);
  console.log('-'.repeat(50));

  const targets: typeof restaurants = [];

  for (const r of restaurants) {
    const menuCount = r._count.menus;
    const status = r.isActive ? '활성' : '비활성';
    const marker = menuCount <= 1 && r.isActive ? ' ← 비활성화 대상' : '';
    console.log(`${r.name.padEnd(30)} ${String(menuCount).padStart(5)} ${status.padStart(8)}${marker}`);

    if (menuCount <= 1 && r.isActive) {
      targets.push(r);
    }
  }

  if (targets.length === 0) {
    console.log('\n비활성화할 식당이 없습니다.');
    return;
  }

  console.log(`\n--- 비활성화 대상: ${targets.length}개 ---`);
  for (const t of targets) {
    console.log(`  - ${t.name} (메뉴 ${t._count.menus}개)`);
  }

  // 비활성화 실행
  const result = await prisma.restaurant.updateMany({
    where: {
      id: { in: targets.map((t) => t.id) },
    },
    data: {
      isActive: false,
    },
  });

  console.log(`\n${result.count}개 식당 비활성화 완료!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
