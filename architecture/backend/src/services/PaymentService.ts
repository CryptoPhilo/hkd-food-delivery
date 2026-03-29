import axios from 'axios';

const PORTONE_API_KEY = process.env.PORTONE_API_KEY || '';
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || '';
const PORTONE_MERCHANT_ID = process.env.PORTONE_MERCHANT_ID || '';

interface PaymentPrepareRequest {
  orderId: string;
  orderName: string;
  amount: number;
  customerEmail?: string;
  customerName?: string;
  customerMobile?: string;
}

interface PaymentPrepareResponse {
  success: boolean;
  paymentId?: string;
  checkoutUrl?: string;
  error?: string;
}

interface PaymentConfirmRequest {
  impUid: string;
  merchantUid: string;
  amount: number;
}

interface PaymentConfirmResponse {
  success: boolean;
  paymentId?: string;
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

interface PrepareAndPayRequest {
  orderId: string;
  orderName: string;
  amount: number;
  customerEmail?: string;
  customerName?: string;
  customerMobile?: string;
}

interface PrepareAndPayResponse {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export class PaymentService {
  private static instance: PaymentService;
  private baseUrl = 'https://api.iamport.kr';

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  private async getAccessToken(): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/users/getToken`, {
        api_key: PORTONE_API_KEY,
        api_secret: PORTONE_API_SECRET,
      });

      if (response.data && response.data.code === 0) {
        return response.data.response.access_token;
      }
      throw new Error('Failed to get PortOne access token');
    } catch (error) {
      console.error('PortOne token error:', error);
      throw error;
    }
  }

  async preparePayment(request: PaymentPrepareRequest): Promise<PaymentPrepareResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const merchantUid = `ORD_${Date.now()}_${request.orderId.slice(0, 8)}`;

      const response = await axios.post(
        `${this.baseUrl}/payments/prepare`,
        {
          merchant_uid: merchantUid,
          amount: request.amount,
          name: request.orderName,
          buyer_email: request.customerEmail,
          buyer_name: request.customerName,
          buyer_tel: request.customerMobile,
        },
        {
          headers: {
            Authorization: accessToken,
          },
        }
      );

      if (response.data && response.data.code === 0) {
        return {
          success: true,
          paymentId: merchantUid,
          checkoutUrl: `https://pgweb.uplus.co.kr/pg/wmp/mertcheck.jsp?PopWinType=y&mertid=${PORTONE_MERCHANT_ID}&merchantuid=${merchantUid}`,
        };
      }

      return {
        success: false,
        error: response.data?.message || 'Payment preparation failed',
      };
    } catch (error) {
      console.error('Payment prepare error:', error);
      return {
        success: false,
        error: 'Payment service unavailable',
      };
    }
  }

  async confirmPayment(request: PaymentConfirmRequest): Promise<PaymentConfirmResponse> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(`${this.baseUrl}/payments/${request.impUid}`, {
        headers: {
          Authorization: accessToken,
        },
      });

      if (response.data && response.data.code === 0) {
        const paymentData = response.data.response;

        if (paymentData.amount === request.amount && paymentData.status === 'paid') {
          return {
            success: true,
            paymentId: paymentData.merchant_uid,
          };
        }

        return {
          success: false,
          error: 'Payment amount mismatch or not paid',
        };
      }

      return {
        success: false,
        error: 'Payment confirmation failed',
      };
    } catch (error) {
      console.error('Payment confirm error:', error);
      return {
        success: false,
        error: 'Payment verification failed',
      };
    }
  }

  async cancelPayment(paymentId: string, amount: number, reason?: string): Promise<PaymentCancelResponse> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/payments/cancel`,
        {
          merchant_uid: paymentId,
          amount: amount,
          reason: reason || 'Customer cancellation',
        },
        {
          headers: {
            Authorization: accessToken,
          },
        }
      );

      if (response.data && response.data.code === 0) {
        return {
          success: true,
          cancelId: response.data.response.cancel_id,
          canceledAmount: response.data.response.cancel_amount,
        };
      }

      return {
        success: false,
        error: response.data?.message || 'Payment cancellation failed',
      };
    } catch (error) {
      console.error('Payment cancel error:', error);
      return {
        success: false,
        error: 'Payment cancellation failed',
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<string | null> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(`${this.baseUrl}/payments/status/${paymentId}`, {
        headers: {
          Authorization: accessToken,
        },
      });

      if (response.data && response.data.code === 0) {
        return response.data.response.status;
      }

      return null;
    } catch (error) {
      console.error('Payment status error:', error);
      return null;
    }
  }

  async prepareAndPay(request: PrepareAndPayRequest): Promise<PrepareAndPayResponse> {
    try {
      const merchantUid = `ORD_${Date.now()}_${request.orderId.slice(0, 8)}`;

      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/payments/onetime`,
        {
          merchant_uid: merchantUid,
          amount: request.amount,
          card_number: '1234-5678-9012-3456',
          card_expiry: '2028-12',
          card_quota: 0,
          name: request.orderName,
          buyer_email: request.customerEmail,
          buyer_name: request.customerName,
          buyer_tel: request.customerMobile,
        },
        {
          headers: {
            Authorization: accessToken,
          },
        }
      );

      if (response.data && response.data.code === 0) {
        return {
          success: true,
          paymentId: merchantUid,
        };
      }

      return {
        success: false,
        error: response.data?.message || 'Payment failed',
      };
    } catch (error) {
      console.error('Prepare and pay error:', error);
      return {
        success: false,
        error: 'Payment service unavailable',
      };
    }
  }
}

export const paymentService = PaymentService.getInstance();
