import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Age Verification API', () => {
  let userId: string;
  let userToken: string;

  beforeEach(async () => {
    await prisma.ageVerification.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.restaurant.deleteMany();
    await prisma.user.deleteMany();
    await prisma.setting.deleteMany();

    const verifyRes = await request(app)
      .post('/api/v1/auth/phone/request')
      .send({ phone: '010-1234-5678' });

    const setting = await prisma.setting.findUnique({
      where: { key: 'verify_010-1234-5678' }
    });
    const code = setting!.value;

    const authRes = await request(app)
      .post('/api/v1/auth/phone/verify')
      .send({ phone: '010-1234-5678', code });

    userToken = authRes.body.access_token;
    userId = authRes.body.user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/age-verification/request', () => {
    it('성인 인증 요청 성공', async () => {
      const response = await request(app)
        .post('/api/v1/age-verification/request')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('인증번호');
      expect(response.body.expiresIn).toBeDefined();
    });

    it('인증 없이 요청 시 401 에러', async () => {
      const response = await request(app)
        .post('/api/v1/age-verification/request');

      expect(response.status).toBe(401);
    });

    it('이미 유효한 인증이 있는 경우', async () => {
      await prisma.ageVerification.create({
        data: {
          userId,
          expiresAt: new Date(Date.now() + 3600000),
          method: 'phone',
          phoneNumber: '010-1234-5678',
          isVerified: true
        }
      });

      const response = await request(app)
        .post('/api/v1/age-verification/request')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('이미 인증');
    });
  });

  describe('POST /api/v1/age-verification/verify', () => {
    let verifyCode: string;

    beforeEach(async () => {
      await request(app)
        .post('/api/v1/age-verification/request')
        .set('Authorization', `Bearer ${userToken}`);

      const setting = await prisma.setting.findUnique({
        where: { key: 'age_verify_010-1234-5678' }
      });
      verifyCode = JSON.parse(setting!.value).code;
    });

    it('올바른 인증번호로 성인 인증 성공', async () => {
      const response = await request(app)
        .post('/api/v1/age-verification/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ code: verifyCode });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('성인 인증이 완료되었습니다');

      const verification = await prisma.ageVerification.findFirst({
        where: { userId, isVerified: true }
      });
      expect(verification).not.toBeNull();
      expect(verification!.method).toBe('phone');
    });

    it('잘못된 인증번호로 검증 실패', async () => {
      const response = await request(app)
        .post('/api/v1/age-verification/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ code: '000000' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('인증번호');
    });

    it('만료된 인증번호로 검증 실패', async () => {
      const setting = await prisma.setting.findUnique({
        where: { key: 'age_verify_010-1234-5678' }
      });
      const value = JSON.parse(setting!.value);
      value.expiresAt = new Date(Date.now() - 1000).toISOString();
      await prisma.setting.update({
        where: { key: 'age_verify_010-1234-5678' },
        data: { value: JSON.stringify(value) }
      });

      const response = await request(app)
        .post('/api/v1/age-verification/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ code: verifyCode });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('만료');
    });

    it('인증 없이 요청 시 401 에러', async () => {
      const response = await request(app)
        .post('/api/v1/age-verification/verify')
        .send({ code: verifyCode });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/age-verification/status', () => {
    it('유효한 인증이 있는 경우', async () => {
      await prisma.ageVerification.create({
        data: {
          userId,
          expiresAt: new Date(Date.now() + 3600000),
          method: 'phone',
          phoneNumber: '010-1234-5678',
          isVerified: true
        }
      });

      const response = await request(app)
        .get('/api/v1/age-verification/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isVerified).toBe(true);
      expect(response.body.data.verifiedAt).toBeDefined();
      expect(response.body.data.expiresAt).toBeDefined();
    });

    it('만료된 인증이 있는 경우', async () => {
      await prisma.ageVerification.create({
        data: {
          userId,
          expiresAt: new Date(Date.now() - 3600000),
          method: 'phone',
          phoneNumber: '010-1234-5678',
          isVerified: true
        }
      });

      const response = await request(app)
        .get('/api/v1/age-verification/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isVerified).toBe(false);
    });

    it('인증 기록이 없는 경우', async () => {
      const response = await request(app)
        .get('/api/v1/age-verification/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isVerified).toBe(false);
    });

    it('인증 없이 요청 시 401 에러', async () => {
      const response = await request(app)
        .get('/api/v1/age-verification/status');

      expect(response.status).toBe(401);
    });
  });
});
