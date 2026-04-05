'use client';

/**
 * 전화번호 SMS 인증 컴포넌트
 * - 전화번호 입력 → SMS 인증번호 요청 → 인증번호 입력 → JWT 토큰 발급
 * - checkout 페이지 등에서 결제 전 인증 단계로 사용
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import PhoneInput from './PhoneInput';
import { useAuth } from '@/contexts/AuthContext';

interface PhoneVerificationProps {
  /** 인증 성공 시 콜백 (phone 번호 전달) */
  onVerified: (phone: string) => void;
  /** 초기 전화번호 */
  initialPhone?: string;
  /** 컴포넌트 외부에서 phone 값 변경 시 호출 */
  onPhoneChange?: (e164: string, display: string) => void;
}

export default function PhoneVerification({
  onVerified,
  initialPhone = '',
  onPhoneChange,
}: PhoneVerificationProps) {
  const t = useTranslations();
  const { isAuthenticated, user, onPhoneVerified } = useAuth();

  const [phone, setPhone] = useState(initialPhone);
  const [displayPhone, setDisplayPhone] = useState(initialPhone);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  // 이미 인증된 상태면 바로 콜백
  useEffect(() => {
    if (isAuthenticated && user) {
      onVerified(user.phone);
    }
  }, [isAuthenticated, user]);

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handlePhoneChange = (e164: string, display: string) => {
    setPhone(e164);
    setDisplayPhone(display);
    onPhoneChange?.(e164, display);
  };

  const requestCode = async () => {
    if (!phone) return;

    setLoading(true);
    setError('');

    try {
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      const res = await fetch('/api/v1/auth/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();

      if (data.success) {
        setCodeSent(true);
        setCountdown(180); // 3분
      } else {
        setError(data.error || '인증번호 전송에 실패했습니다');
      }
    } catch {
      setError('서버 연결에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code || code.length !== 6) return;

    setLoading(true);
    setError('');

    try {
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      const res = await fetch('/api/v1/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // httpOnly 쿠키로 Refresh Token 수신
        body: JSON.stringify({ phone: cleanPhone, code }),
      });
      const data = await res.json();

      if (data.success) {
        // AuthContext에 Access Token 저장 (Refresh Token은 서버가 쿠키로 설정)
        onPhoneVerified({
          access_token: data.access_token,
          user: data.user,
        });
        onVerified(cleanPhone);
      } else {
        setError(data.error || '인증번호가 일치하지 않습니다');
      }
    } catch {
      setError('서버 연결에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 이미 인증된 상태
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-green-700 text-sm font-medium">
          {user.phone} 인증 완료
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <PhoneInput
          value={displayPhone}
          onChange={handlePhoneChange}
          className="flex-1"
          required
        />
        <button
          type="button"
          onClick={requestCode}
          disabled={loading || !phone || countdown > 0}
          className="px-4 py-2 bg-airbnb-red text-white text-sm rounded-lg font-medium disabled:opacity-50 whitespace-nowrap"
        >
          {countdown > 0
            ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`
            : codeSent
              ? '재전송'
              : '인증번호 받기'}
        </button>
      </div>

      {codeSent && (
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="인증번호 6자리"
            maxLength={6}
            className="flex-1 border rounded-lg px-3 py-2 text-center tracking-widest"
          />
          <button
            type="button"
            onClick={verifyCode}
            disabled={loading || code.length !== 6}
            className="px-4 py-2 bg-airbnb-black text-white text-sm rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? '확인 중...' : '확인'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
}
