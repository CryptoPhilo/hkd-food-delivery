'use client';

import { LOCALE_FLAGS } from '@/i18n/config';

interface LocaleBadgeProps {
  locale: string;
}

export default function LocaleBadge({ locale }: LocaleBadgeProps) {
  const flag = LOCALE_FLAGS[locale] || '🌐';
  const name = locale.toUpperCase();
  const isNonKorean = locale !== 'ko';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 500,
      background: isNonKorean ? '#FFF3CD' : '#E8F5E9',
      border: isNonKorean ? '1px solid #FFC107' : '1px solid #81C784',
      color: isNonKorean ? '#856404' : '#2E7D32',
    }}>
      {flag} {name}
    </span>
  );
}
