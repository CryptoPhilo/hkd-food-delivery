import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 공통 모델 메서드 생성 헬퍼 */
function createModelMock(defaults: Record<string, any> = {}) {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(defaults && Object.keys(defaults).length > 0 ? { id: 'mock-id', ...defaults } : null),
    findFirst: jest.fn().mockResolvedValue(defaults && Object.keys(defaults).length > 0 ? { id: 'mock-id', ...defaults } : null),
    create: jest.fn().mockResolvedValue({ id: 'mock-id', ...defaults }),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    createManyAndReturn: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ id: 'mock-id', ...defaults }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({ id: 'mock-id', ...defaults }),
    delete: jest.fn().mockResolvedValue({ id: 'mock-id' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: {}, _avg: {}, _count: 0 }),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

/**
 * SMSService 모킹 (실제 Aligo API 호출 방지)
 */
jest.mock('../src/services/SMSService', () => {
  const mockSendSMS = jest.fn().mockResolvedValue({
    success: true,
    messageId: 'test-msg-id',
  });

  const mockInstance = {
    sendSMS: mockSendSMS,
    destroy: jest.fn(),
  };

  return {
    SMSService: {
      getInstance: jest.fn().mockReturnValue(mockInstance),
    },
    smsService: mockInstance,
  };
});

jest.mock('@prisma/client', () => {
  // Create a single mocked instance that all tests will share
  const mockInstance = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
    $transaction: jest.fn().mockImplementation((fn: any) => {
      if (typeof fn === 'function') {
        return fn(new Proxy({}, {
          get: (_target, prop) => createModelMock(),
        }));
      }
      return Promise.resolve([]);
    }),
    restaurant: createModelMock(),
    order: createModelMock(),
    orderItem: createModelMock(),
    menu: createModelMock(),
    driver: createModelMock(),
    settlement: createModelMock(),
    settlementItem: createModelMock(),
    product: createModelMock(),
    store: createModelMock(),
    auditLog: createModelMock(),
    setting: createModelMock(),
    token: createModelMock(),
    user: createModelMock(),
    ageVerification: createModelMock(),
    adminUser: createModelMock({
      id: 'admin-jeju',
      username: 'admin-jeju',
      passwordHash: '$2a$10$mockPasswordHash',
      name: '관리자 김영수',
      role: 'system_admin',
      isActive: true,
      lastLoginAt: null,
    }),
    region: createModelMock({
      id: 'region-jeju',
      code: 'jeju-hangyeong',
      name: '제주 한경',
      nameEn: 'Jeju Hangyeong',
    }),
  };

  const mockPrismaClient = jest.fn().mockReturnValue(mockInstance);

  return { PrismaClient: mockPrismaClient };
});

afterAll(async () => {
  await prisma.$disconnect();
});
