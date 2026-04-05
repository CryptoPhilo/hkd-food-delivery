import { PrismaClient } from '@prisma/client';
import { smsService } from './SMSService';

const prisma = new PrismaClient();

interface AgeVerificationRequest {
  userId: string;
  phoneNumber: string;
}

interface AgeVerificationVerify {
  userId: string;
  code: string;
}

export class AgeVerificationService {
  private static instance: AgeVerificationService;

  constructor() {}

  static getInstance(): AgeVerificationService {
    if (!AgeVerificationService.instance) {
      AgeVerificationService.instance = new AgeVerificationService();
    }
    return AgeVerificationService.instance;
  }

  async requestVerification(input: AgeVerificationRequest) {
    const { userId, phoneNumber } = input;

    const existingVerification = await prisma.ageVerification.findFirst({
      where: {
        userId,
        isVerified: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingVerification) {
      return {
        success: true,
        message: '이미 인증이 완료되었습니다',
        expiresAt: existingVerification.expiresAt,
      };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    await prisma.setting.create({
      data: {
        key: `age_verify_${phoneNumber}`,
        value: JSON.stringify({ code, expiresAt: expiresAt.toISOString() }),
        type: 'age_verification',
      },
    });

    try {
      await smsService.sendVerificationCode(phoneNumber, code);
    } catch (error) {
    }

    return {
      success: true,
      message: '인증번호가 전송되었습니다',
      expiresIn: 180,
    };
  }

  async verify(input: AgeVerificationVerify) {
    const { userId, code } = input;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const setting = await prisma.setting.findUnique({
      where: { key: `age_verify_${user.phone}` },
    });

    if (!setting) {
      throw new Error('인증 요청이 없습니다');
    }

    const verificationData = JSON.parse(setting.value);

    if (verificationData.code !== code) {
      throw new Error('인증번호가 일치하지 않습니다');
    }

    if (new Date(verificationData.expiresAt) < new Date()) {
      throw new Error('인증번호가 만료되었습니다');
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const verification = await prisma.ageVerification.create({
      data: {
        userId,
        expiresAt,
        method: 'phone',
        phoneNumber: user.phone,
        isVerified: true,
      },
    });

    await prisma.setting.delete({
      where: { key: `age_verify_${user.phone}` },
    });

    return {
      success: true,
      message: '성인 인증이 완료되었습니다',
      verificationId: verification.id,
      expiresAt: verification.expiresAt,
    };
  }

  async getStatus(userId: string) {
    const verification = await prisma.ageVerification.findFirst({
      where: {
        userId,
        isVerified: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { verifiedAt: 'desc' },
    });

    if (!verification) {
      return {
        isVerified: false,
        message: '유효한 성인 인증이 없습니다',
      };
    }

    return {
      isVerified: true,
      verifiedAt: verification.verifiedAt,
      expiresAt: verification.expiresAt,
      method: verification.method,
    };
  }

  async isVerified(userId: string): Promise<boolean> {
    const status = await this.getStatus(userId);
    return status.isVerified;
  }

  async verifyForOrder(userId: string, verificationId?: string): Promise<boolean> {
    if (verificationId) {
      const verification = await prisma.ageVerification.findFirst({
        where: {
          id: verificationId,
          userId,
          isVerified: true,
        },
      });

      if (verification) {
        const expiresAt = new Date(verification.expiresAt);
        const now = new Date();
        if (expiresAt.getTime() > now.getTime()) {
          return true;
        }
      }
    }

    return this.isVerified(userId);
  }
}

export const ageVerificationService = AgeVerificationService.getInstance();
