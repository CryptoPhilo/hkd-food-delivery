import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SettlementConfig {
  serviceFeeRate: number;
  taxRate: number;
}

interface GenerateResult {
  generated: number;
  settlements: any[];
}

interface CurrentSettlement {
  period: string;
  toDate: string;
  totalDeliveries: number;
  totalDeliveryFee: number;
  estimatedServiceFee: number;
  estimatedTax: number;
  estimatedNetAmount: number;
  daysRemaining: number;
}

export class SettlementService {
  private defaultConfig: SettlementConfig = {
    serviceFeeRate: 0.10,
    taxRate: 0.033
  };

  async generateMonthlySettlement(
    period: string,
    config: Partial<SettlementConfig> = {}
  ): Promise<GenerateResult> {
    const finalConfig = { ...this.defaultConfig, ...config };

    const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!periodRegex.test(period)) {
      throw new Error('기간 형식이 올바르지 않습니다 (YYYY-MM)');
    }

    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const drivers = await prisma.driver.findMany({
      where: {
        orders: {
          some: {
            status: 'completed',
            deliveredAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    });

    const settlements: any[] = [];

    for (const driver of drivers) {
      const existing = await prisma.settlement.findUnique({
        where: {
          driverId_period: {
            driverId: driver.id,
            period
          }
        }
      });

      if (existing) {
        continue;
      }

      const orders = await prisma.order.findMany({
        where: {
          driverId: driver.id,
          status: 'completed',
          deliveredAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const totalDeliveries = orders.length;
      const totalDeliveryFee = orders.reduce((sum, o) => sum + o.deliveryFee, 0);

      const serviceFee = Math.floor(totalDeliveryFee * finalConfig.serviceFeeRate);
      const tax = Math.floor((totalDeliveryFee - serviceFee) * finalConfig.taxRate);
      const grossAmount = totalDeliveryFee;
      const netAmount = grossAmount - serviceFee - tax;

      const settlement = await prisma.settlement.create({
        data: {
          driverId: driver.id,
          period,
          startDate,
          endDate,
          totalDeliveries,
          totalDeliveryFee,
          serviceFeeRate: finalConfig.serviceFeeRate,
          serviceFee,
          taxRate: finalConfig.taxRate,
          tax,
          bonus: 0,
          penalty: 0,
          grossAmount,
          netAmount,
          status: 'calculated'
        }
      });

      for (const order of orders) {
        await prisma.settlementItem.create({
          data: {
            settlementId: settlement.id,
            orderId: order.id,
            deliveryFee: order.deliveryFee,
            deliveredAt: order.deliveredAt!
          }
        });
      }

      settlements.push(settlement);
    }

    return {
      generated: settlements.length,
      settlements
    };
  }

  async getSettlements(
    filters: {
      period?: string;
      status?: string;
      driverId?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { period, status, driverId, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (period) where.period = period;
    if (status) where.status = status;
    if (driverId) where.driverId = driverId;

    const total = await prisma.settlement.count({ where });

    const settlements = await prisma.settlement.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    const allSettlements = await prisma.settlement.findMany({ where });

    const summary = {
      totalDeliveries: allSettlements.reduce((sum, s) => sum + s.totalDeliveries, 0),
      totalDeliveryFee: allSettlements.reduce((sum, s) => sum + s.totalDeliveryFee, 0),
      totalNetAmount: allSettlements.reduce((sum, s) => sum + s.netAmount, 0),
      pendingCount: allSettlements.filter(s => s.status === 'calculated').length,
      paidCount: allSettlements.filter(s => s.status === 'paid').length
    };

    return {
      settlements,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      summary
    };
  }

  async getSettlementById(id: string) {
    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            bankName: true,
            bankAccount: true,
            accountHolder: true
          }
        },
        items: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                deliveryAddress: true
              }
            }
          }
        }
      }
    });

    return settlement;
  }

  async approveSettlement(
    settlementId: string,
    adminId: string,
    notes?: string
  ) {
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId }
    });

    if (!settlement) {
      throw new Error('정산을 찾을 수 없습니다');
    }

    if (settlement.status !== 'calculated') {
      throw new Error('계산 완료 상태의 정산만 승인할 수 있습니다');
    }

    const updated = await prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'approved',
        approvedBy: adminId,
        approvedAt: new Date(),
        notes
      }
    });

    return updated;
  }

  async markAsPaid(
    settlementId: string,
    paidAmount: number,
    paidAt: Date,
    notes?: string
  ) {
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId }
    });

    if (!settlement) {
      throw new Error('정산을 찾을 수 없습니다');
    }

    if (settlement.status !== 'approved') {
      throw new Error('승인된 정산만 지급 처리할 수 있습니다');
    }

    if (paidAmount <= 0) {
      throw new Error('지급액은 0보다 커야 합니다');
    }

    const updated = await prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'paid',
        paidAmount,
        paidAt,
        notes
      }
    });

    return updated;
  }

  async getDriverSettlements(driverId: string) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        name: true,
        phone: true
      }
    });

    if (!driver) {
      throw new Error('배달원을 찾을 수 없습니다');
    }

    const settlements = await prisma.settlement.findMany({
      where: { driverId },
      orderBy: { period: 'desc' }
    });

    return {
      driver,
      settlements
    };
  }

  async getDriverSettlementDetail(driverId: string, settlementId: string) {
    const settlement = await prisma.settlement.findFirst({
      where: {
        id: settlementId,
        driverId
      },
      include: {
        items: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                deliveryAddress: true,
                deliveredAt: true
              }
            }
          }
        }
      }
    });

    return settlement;
  }

  async getCurrentSettlement(driverId: string): Promise<CurrentSettlement> {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId }
    });

    if (!driver) {
      throw new Error('배달원을 찾을 수 없습니다');
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const startDate = new Date(year, month, 1);
    const endDate = now;

    const orders = await prisma.order.findMany({
      where: {
        driverId,
        status: 'completed',
        deliveredAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const totalDeliveries = orders.length;
    const totalDeliveryFee = orders.reduce((sum, o) => sum + o.deliveryFee, 0);

    const serviceFeeRate = this.defaultConfig.serviceFeeRate;
    const taxRate = this.defaultConfig.taxRate;

    const estimatedServiceFee = Math.floor(totalDeliveryFee * serviceFeeRate);
    const estimatedTax = Math.floor((totalDeliveryFee - estimatedServiceFee) * taxRate);
    const estimatedNetAmount = totalDeliveryFee - estimatedServiceFee - estimatedTax;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();

    return {
      period: `${year}-${String(month + 1).padStart(2, '0')}`,
      toDate: now.toISOString().split('T')[0],
      totalDeliveries,
      totalDeliveryFee,
      estimatedServiceFee,
      estimatedTax,
      estimatedNetAmount,
      daysRemaining
    };
  }
}

export const settlementService = new SettlementService();
