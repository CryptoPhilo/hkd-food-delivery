import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BusinessHours {
  openTime: string;
  closeTime: string;
  closedDays: string[];
  isHoliday: boolean;
  holidayMessage?: string;
}

export class BusinessHoursService {
  private static instance: BusinessHoursService;
  private cachedHours: BusinessHours | null = null;
  private cacheExpiry: Date | null = null;

  static getInstance(): BusinessHoursService {
    if (!BusinessHoursService.instance) {
      BusinessHoursService.instance = new BusinessHoursService();
    }
    return BusinessHoursService.instance;
  }

  private async getBusinessHours(): Promise<BusinessHours> {
    const now = new Date();
    
    if (this.cachedHours && this.cacheExpiry && this.cacheExpiry > now) {
      return this.cachedHours;
    }

    const setting = await prisma.setting.findFirst({
      where: { key: 'business_hours', type: 'business_hours' },
    });

    if (setting) {
      this.cachedHours = JSON.parse(setting.value);
      this.cacheExpiry = new Date(now.getTime() + 60 * 1000);
      return this.cachedHours!;
    }

    return {
      openTime: '09:00',
      closeTime: '22:00',
      closedDays: ['sunday'],
      isHoliday: false,
    };
  }

  async isCurrentlyOpen(): Promise<boolean> {
    const hours = await this.getBusinessHours();
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    if (hours.isHoliday) {
      return false;
    }

    if (hours.closedDays.includes(dayOfWeek)) {
      return false;
    }

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMin] = hours.openTime.split(':').map(Number);
    const [closeHour, closeMin] = hours.closeTime.split(':').map(Number);

    const openTimeMinutes = openHour * 60 + openMin;
    const closeTimeMinutes = closeHour * 60 + closeMin;

    return currentTime >= openTimeMinutes && currentTime < closeTimeMinutes;
  }

  async getBusinessStatus(): Promise<{
    isOpen: boolean;
    message?: string;
    nextOpenTime?: string;
  }> {
    const hours = await this.getBusinessHours();
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    if (hours.isHoliday) {
      return {
        isOpen: false,
        message: hours.holidayMessage || '오늘은 휴일입니다.',
      };
    }

    if (hours.closedDays.includes(dayOfWeek)) {
      const dayNames: Record<string, string> = {
        monday: '월요일',
        tuesday: '화요일',
        wednesday: '수요일',
        thursday: '목요일',
        friday: '금요일',
        saturday: '토요일',
        sunday: '일요일',
      };
      return {
        isOpen: false,
        message: `매주 ${dayNames[dayOfWeek]}은 휴일입니다.`,
      };
    }

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMin] = hours.openTime.split(':').map(Number);
    const [closeHour, closeMin] = hours.closeTime.split(':').map(Number);

    const openTimeMinutes = openHour * 60 + openMin;
    const closeTimeMinutes = closeHour * 60 + closeMin;

    if (currentTime < openTimeMinutes) {
      return {
        isOpen: false,
        message: `영업 시작 시간은 ${hours.openTime}입니다.`,
        nextOpenTime: hours.openTime,
      };
    }

    if (currentTime >= closeTimeMinutes) {
      return {
        isOpen: false,
        message: `오늘 영업이 종료되었습니다. 내일 ${hours.openTime}에 다시 찾아주세요.`,
      };
    }

    return {
      isOpen: true,
    };
  }

  clearCache(): void {
    this.cachedHours = null;
    this.cacheExpiry = null;
  }
}

export const businessHoursService = BusinessHoursService.getInstance();
