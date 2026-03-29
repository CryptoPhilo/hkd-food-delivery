import axios from 'axios';

const ALIGO_API_KEY = process.env.ALIGO_API_KEY || '';
const ALIGO_USER_ID = process.env.ALIGO_USER_ID || '';
const ALIGO_SENDER = process.env.ALIGO_SENDER || '';

interface SMSRequest {
  to: string;
  message: string;
}

interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SMSService {
  private static instance: SMSService;
  private apiUrl = 'https://aligo.rmms.co.kr/SMS_02_GB.php';

  static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  async sendSMS(request: SMSRequest): Promise<SMSResponse> {
    const { to, message } = request;

    try {
      const formData = new URLSearchParams();
      formData.append('key', ALIGO_API_KEY);
      formData.append('user_id', ALIGO_USER_ID);
      formData.append('sender', ALIGO_SENDER);
      formData.append('receiver', to);
      formData.append('msg', message);

      const response = await axios.post(this.apiUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.data && parseInt(response.data.result_code) === 0) {
        return {
          success: true,
          messageId: response.data.msg_id,
        };
      } else {
        return {
          success: false,
          error: response.data?.message || 'SMS sending failed',
        };
      }
    } catch (error) {
      console.error('SMS sending error:', error);
      return {
        success: false,
        error: 'SMS service unavailable',
      };
    }
  }

  async sendOrderConfirmation(phone: string, orderNumber: string, estimatedTime: number): Promise<SMSResponse> {
    const message = `[한경배달]
주문이 완료되었습니다.
주문번호: ${orderNumber}
예상 배달 시간: 약 ${estimatedTime}분

감사합니다.`;

    return this.sendSMS({ to: phone, message });
  }

  async sendPickupNotification(phone: string, orderNumber: string, pickupTime: Date): Promise<SMSResponse> {
    const pickupTimeStr = pickupTime.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const message = `[한경배달]
주문번호: ${orderNumber}
픽업 가능 시간: ${pickupTimeStr}

해당 시간에 픽업 예정입니다.`;

    return this.sendSMS({ to: phone, message });
  }

  async sendDeliveryComplete(phone: string, orderNumber: string): Promise<SMSResponse> {
    const message = `[한경배달]
주문번호: ${orderNumber}의 배달이 완료되었습니다.

감사합니다.`;

    return this.sendSMS({ to: phone, message });
  }

  async sendCancellationConfirmation(phone: string, orderNumber: string): Promise<SMSResponse> {
    const message = `[한경배달]
주문번호: ${orderNumber}의 주문이 취소되었습니다.
환불은 3~5일 이내에 처리됩니다.

감사합니다.`;

    return this.sendSMS({ to: phone, message });
  }

  async sendVerificationCode(phone: string, code: string): Promise<SMSResponse> {
    const message = `[한경배달]
성인 인증번호: ${code}

3분 이내에 입력해주세요.`;

    return this.sendSMS({ to: phone, message });
  }
}

export const smsService = SMSService.getInstance();
