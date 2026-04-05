import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger';
import { t } from '../i18n';

// ============================================
// Naver Cloud SENS 설정
// ============================================
const NCP_ACCESS_KEY = process.env.NCP_ACCESS_KEY || '';
const NCP_SECRET_KEY = process.env.NCP_SECRET_KEY || '';
const SENS_SERVICE_ID = process.env.SENS_SERVICE_ID || '';
const SENS_SENDER = process.env.SENS_SENDER || '';

interface SMSRequest {
  to: string;
  message: string;
}

interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface RetryItem {
  request: SMSRequest;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  resolve: (value: SMSResponse) => void;
}

class SMSService {
  private static instance: SMSService;
  private readonly apiBaseUrl = 'https://sens.apigw.ntruss.com';
  private retryQueue: RetryItem[] = [];
  private retryTimer: NodeJS.Timeout | null = null;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly BASE_DELAY_MS = 2000;
  private readonly isEnabled: boolean;

  // 일일 발송량 추적
  private dailySendCount = 0;
  private dailyResetDate = new Date().toDateString();
  private readonly DAILY_LIMIT = 10000;

  static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  private constructor() {
    this.isEnabled = !!(NCP_ACCESS_KEY && NCP_SECRET_KEY && SENS_SERVICE_ID && SENS_SENDER
      && NCP_ACCESS_KEY !== 'test_access_key' && NCP_ACCESS_KEY !== '');

    if (!this.isEnabled) {
      logger.warn('[SMS] Naver SENS 자격증명 미설정 - 개발용 로그 모드로 동작합니다');
    }

    if (this.isEnabled) {
      this.retryTimer = setInterval(() => this.processRetryQueue(), 10000);
    }
  }

  // ============================================
  // HMAC-SHA256 서명 생성 (Naver Cloud API 인증)
  // ============================================
  private makeSignature(method: string, uri: string, timestamp: string): string {
    const message = `${method} ${uri}\n${timestamp}\n${NCP_ACCESS_KEY}`;
    const hmac = crypto.createHmac('sha256', NCP_SECRET_KEY);
    hmac.update(message);
    return hmac.digest('base64');
  }

  /**
   * SMS 발송 (자동 재시도 포함)
   */
  async sendSMS(request: SMSRequest): Promise<SMSResponse> {
    // 개발용 로그 모드
    if (!this.isEnabled) {
      const maskedPhone = request.to.replace(/(\d{3})\d{4}(\d+)/, '$1****$2');
      logger.info('[SMS-DEV] 문자 발송 (로그 모드)', {
        to: maskedPhone,
        message: request.message.slice(0, 50) + '...',
      });
      this.dailySendCount++;
      return { success: true, messageId: `dev_${Date.now()}` };
    }

    // 일일 발송량 체크
    this.checkDailyReset();
    if (this.dailySendCount >= this.DAILY_LIMIT) {
      logger.error('SMS 일일 발송 한도 초과', { limit: this.DAILY_LIMIT, count: this.dailySendCount });
      return { success: false, error: '일일 발송 한도 초과' };
    }

    try {
      const result = await this.doSend(request);
      if (result.success) {
        this.dailySendCount++;
        return result;
      }
      return this.enqueueRetry(request);
    } catch (error: any) {
      logger.error('SMS 발송 실패, 재시도 큐에 추가', { to: request.to, error: error.message });
      return this.enqueueRetry(request);
    }
  }

  /**
   * Naver SENS API 호출
   */
  private async doSend(request: SMSRequest): Promise<SMSResponse> {
    const { to, message } = request;
    const serviceId = SENS_SERVICE_ID.trim();
    const uri = `/sms/v2/services/${serviceId}/messages`;
    const timestamp = Date.now().toString();
    const signature = this.makeSignature('POST', uri, timestamp);

    // 80바이트 이하 SMS, 초과 시 LMS 자동 선택
    const byteLength = Buffer.byteLength(message, 'utf8');
    const type = byteLength <= 80 ? 'SMS' : 'LMS';

    const body = {
      type,
      contentType: 'COMM',
      countryCode: '82',
      from: SENS_SENDER.trim(),
      content: message,
      messages: [{ to: to.replace(/-/g, '') }],
    };

    const fullUrl = `${this.apiBaseUrl}${uri}`;
    logger.info('[SMS] API 호출', {
      url: fullUrl,
      serviceId: serviceId,
      sender: SENS_SENDER.trim(),
      accessKey: NCP_ACCESS_KEY.trim().slice(0, 8) + '...',
      to: to.replace(/(\d{3})\d{4}(\d+)/, '$1****$2'),
      type,
    });

    const response = await axios.post(fullUrl, body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': NCP_ACCESS_KEY.trim(),
        'x-ncp-apigw-signature-v2': signature,
      },
      timeout: 10000,
      validateStatus: () => true, // 모든 상태코드 허용 (에러 throw 방지)
    });

    logger.info('[SMS] API 응답', {
      status: response.status,
      statusText: response.statusText,
      data: JSON.stringify(response.data).slice(0, 500),
      headers: JSON.stringify(response.headers).slice(0, 300),
    });

    if (response.status === 202 || (response.data && response.data.statusCode === '202')) {
      const msgId = response.data.messages?.[0]?.messageId || response.data.requestId;
      return { success: true, messageId: msgId };
    }

    return {
      success: false,
      error: `HTTP ${response.status}: ${response.data?.statusName || response.data?.error || JSON.stringify(response.data).slice(0, 200)}`,
    };
  }

  /**
   * 재시도 큐에 추가
   */
  private enqueueRetry(request: SMSRequest): Promise<SMSResponse> {
    return new Promise((resolve) => {
      this.retryQueue.push({
        request,
        attempts: 1,
        maxAttempts: this.MAX_RETRY_ATTEMPTS,
        nextRetryAt: Date.now() + this.BASE_DELAY_MS,
        resolve,
      });
    });
  }

  private removeFromQueue(item: RetryItem): void {
    const idx = this.retryQueue.indexOf(item);
    if (idx >= 0) this.retryQueue.splice(idx, 1);
  }

  /**
   * 재시도 큐 처리
   */
  private async processRetryQueue(): Promise<void> {
    const now = Date.now();
    const readyItems = this.retryQueue.filter(item => item.nextRetryAt <= now);

    for (const item of readyItems) {
      try {
        const result = await this.doSend(item.request);
        if (result.success) {
          this.dailySendCount++;
          item.resolve(result);
          this.removeFromQueue(item);
        } else {
          item.attempts++;
          if (item.attempts >= item.maxAttempts) {
            logger.error('[SMS] 최대 재시도 횟수 초과', {
              to: item.request.to,
              attempts: item.attempts,
            });
            item.resolve({ success: false, error: '최대 재시도 횟수 초과' });
            this.removeFromQueue(item);
          } else {
            item.nextRetryAt = now + this.BASE_DELAY_MS * Math.pow(2, item.attempts - 1);
          }
        }
      } catch (error: any) {
        item.attempts++;
        if (item.attempts >= item.maxAttempts) {
          item.resolve({ success: false, error: error.message });
          this.removeFromQueue(item);
        } else {
          item.nextRetryAt = now + this.BASE_DELAY_MS * Math.pow(2, item.attempts - 1);
        }
      }
    }
  }

  private checkDailyReset(): void {
    const today = new Date().toDateString();
    if (today !== this.dailyResetDate) {
      this.dailySendCount = 0;
      this.dailyResetDate = today;
    }
  }

  /** 큐 상태 조회 */
  getQueueStatus(): { queueSize: number; dailySendCount: number; dailyLimit: number } {
    return {
      queueSize: this.retryQueue.length,
      dailySendCount: this.dailySendCount,
      dailyLimit: this.DAILY_LIMIT,
    };
  }

  // ===== 알림 템플릿 =====

  async sendOrderConfirmation(phone: string, orderNumber: string, estimatedTime: number, locale: string = 'ko'): Promise<SMSResponse> {
    const prefix = t(locale, 'sms.brandPrefix');
    const body = [
      t(locale, 'sms.orderReceived.title'),
      t(locale, 'sms.orderReceived.orderNumber', { orderNumber }),
      t(locale, 'sms.orderReceived.estimatedTime', { estimatedTime: String(estimatedTime) }),
      '',
      t(locale, 'sms.orderReceived.waitingPickupTime'),
    ].join('\n');
    return this.sendSMS({ to: phone, message: `${prefix}\n${body}` });
  }

  async sendPickupNotification(phone: string, orderNumber: string, pickupTime: Date, locale: string = 'ko'): Promise<SMSResponse> {
    const pickupTimeStr = pickupTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const prefix = t(locale, 'sms.brandPrefix');
    const body = t(locale, 'sms.pickupNotification', { orderNumber, pickupTimeStr });
    return this.sendSMS({ to: phone, message: `${prefix}\n${body}` });
  }

  async sendDeliveryComplete(phone: string, orderNumber: string, locale: string = 'ko'): Promise<SMSResponse> {
    const prefix = t(locale, 'sms.brandPrefix');
    const body = t(locale, 'sms.deliveryComplete', { orderNumber });
    return this.sendSMS({ to: phone, message: `${prefix}\n${body}` });
  }

  async sendCancellationConfirmation(phone: string, orderNumber: string, locale: string = 'ko'): Promise<SMSResponse> {
    const prefix = t(locale, 'sms.brandPrefix');
    const body = t(locale, 'sms.cancelled', { orderNumber });
    return this.sendSMS({ to: phone, message: `${prefix}\n${body}` });
  }

  async sendVerificationCode(phone: string, code: string, locale: string = 'ko'): Promise<SMSResponse> {
    const prefix = t(locale, 'sms.brandPrefix');
    const body = t(locale, 'sms.verificationCode', { code });
    return this.sendSMS({ to: phone, message: `${prefix}\n${body}` });
  }

  /** 리소스 정리 */
  destroy(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    for (const item of this.retryQueue) {
      item.resolve({ success: false, error: 'Service shutdown' });
    }
    this.retryQueue = [];
  }
}

export const smsService = SMSService.getInstance();
