'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { locales, localeNames, Locale } from '@/i18n/config';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  const handleChange = async (newLocale: Locale) => {
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: newLocale }),
    });
    router.refresh();
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value as Locale)}
      aria-label="Language"
      style={{
        padding: '4px 8px',
        borderRadius: '6px',
        border: '1px solid #ddd',
        fontSize: '14px',
        background: 'white',
        cursor: 'pointer',
      }}
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeNames[loc]}
        </option>
      ))}
    </select>
  );
}
