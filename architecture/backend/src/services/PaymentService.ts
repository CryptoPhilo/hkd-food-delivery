import axios from 'axios';
import { auditLogger } from '../utils/security.utils';
import logger from '../utils/logger';

// ============================================
// PortOne V2 설정
// ============================================
const PORTONE_V2_API_SECRET = process.env.PORTONE_V2_API_SECRET || '';

interface PaymentVerifyRequest {
  paymentId: string;
  amount: number;
}

interface PaymentVerifyResponse {
  success: boolean;
  paymentId?: string;
  status?: string;
  amount?: number;
  error?: string;
}

interface PaymentCancelRequest {
  paymentId: string;
  amount: number;
  reason?: string;
}

interface PaymentCancelResponse {
  success: boolean;
  cancelId?: string;
  canceledAmount?: number;
  error?: string;
}

export class PaymentService {
  private static instance: PaymentService;
  private readonly apiBaseUrl = 'https://api.portone.io';
  private readonly isEnabled: boolean;

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  private constructor() {
    this.isEnabled = !!(PORTONE_V2_API_SECRET
      && PORTONE_V2_API_SECRET !== 'test_api_secret' && PORTONE_V2_API_SECRET !== '');

    if (!this.isEnabled) {
      logger.warn('[Payment] PortOne V2 API Secret 미설정 - 개발용 로그 모드로 동작합니다');
    }
  }

  /**
   * PortOne V2 API 공통 헤더
   */
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `PortOne ${PORTONE_V2_API_SECRET}`,
    };
  }

  /**
   * 결제 검증 (서버 사이드)
   * - PortOne V2 API로 결제 정보 조회
   * - 금액 일치 여부 확인
   * - 결제 상태 확인
   */
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse> {
    if (!this.isEnabled) {
      logger.info('[Payment-DEV] 결제 검증 (로그 모드)', {
        paymentId: request.paymentId,
        amount: request.amount,
      });
      return { success: true, paymentId: request.paymentId, status: 'PAID', amount: request.amount };
    }

    try {
      // PortOne V2: 결제 내역 단건 조회
      const response = await axios.get(
        `${this.apiBaseUrl}/payments/${encodeURIComponent(request.paymentId)}`,
        {
          headers: this.getHeaders(),
          timeout: 15000,
        }
      );

      const payment = response.data;

      // 결제 상태 확인
      if (payment.status !== 'PAID') {
        auditLogger.log({
          action: 'PAYMENT_VERIFY_STATUS_FAIL',
          resource: 'payment',
          resourceId: request.paymentId,
          details: { expectedStatus: 'PAID', actualStatus: payment.status },
        });
        return {
          success: false,
          status: payment.status,
          error: `결제가 완료되지 않았습니다 (상태: ${payment.status})`,
        };
      }

      // 금액 일치 검증
      const paidAmount = payment.amount?.total;
      if (paidAmount !== request.amount) {
        auditLogger.logSecurityEvent({
          type: 'suspicious_input',
          details: {
            reason: 'payment_amount_mismatch',
            expected: request.amount,
            actual: paidAmount,
            paymentId: request.paymentId,
          },
        });
        return {
          success: false,
          error: `결제 금액 불일치: 요청(${request.amount}) vs 실제(${paidAmount})`,
        };
      }

      auditLogger.log({
        action: 'PAYMENT_VERIFY_SUCCESS',
        resource: 'payment',
        resourceId: request.paymentId,
        details: { amount: paidAmount, method: payment.method?.type },
      });

      return {
        success: true,
        paymentId: request.paymentId,
        status: 'PAID',
        amount: paidAmount,
      };

    } catch (error: any) {
      const status = error.response?.status;
      const errorMsg = error.response?.data?.message || error.message;
      logger.error('결제 검증 오류', { paymentId: request.paymentId, status, error: errorMsg });

      return {
        success: false,
        error: `결제 검증 실패: ${errorMsg}`,
      };
    }
  }

  async cancelPayment(paymentId: string, amount: number, reason?: string): Promise<PaymentCancelResponse> {
    if (!this.isEnabled) {
      logger.info('[Payment-DEV] 결제 취소 (로그 모드)', { paymentId, amount, reason });
      return { success: true, cancelId: `dev_cancel_${Date.now()}`, canceledAmount: amount };
    }

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/payments/${encodeURIComponent(paymentId)}/cancel`,
        {
          amount,
          reason: reason || '고객 요청에 의한 취소',
        },
        {
          headers: this.getHeaders(),
          timeout: 15000,
        }
      );

      auditLogger.log({
        action: 'PAYMENT_CANCEL_SUCCESS',
        resource: 'payment',
        resourceId: paymentId,
        details: { amount, reason },
      });


      return {
        success: true,
        cancelId: response.data?.cancellation?.id,
        canceledAmount: amount,
      };
    } catch (error: any) {
      logger.error('결제 취소 오류', { paymentId, error: error.message });
      return {
        success: false,
        error: error.response?.data?.message || 'Payment cancellation failed',
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<string | null> {
    if (!this.isEnabled) {
      logger.info('[Payment-DEV] 결제 상태 조회 (로그 모드)', { paymentId });
      return 'PAID';
    }

    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/payments/${encodeURIComponent(paymentId)}`,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      return response.data?.status || null;
    } catch (error) {
      console.error('Payment status error:', error);
      return null;
    }
  }
}

export const paymentService = PaymentService.getInstance();
