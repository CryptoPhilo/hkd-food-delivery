'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { LOCALE_TO_COUNTRY, PRIORITY_COUNTRIES } from '@/i18n/config';

// Country calling codes — priority countries first
const COUNTRY_CALLING_CODES: { code: string; dialCode: string; flag: string; maxLen: number }[] = [
  { code: 'KR', dialCode: '+82', flag: '🇰🇷', maxLen: 11 },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', maxLen: 10 },
  { code: 'JP', dialCode: '+81', flag: '🇯🇵', maxLen: 11 },
  { code: 'CN', dialCode: '+86', flag: '🇨🇳', maxLen: 11 },
  { code: 'FR', dialCode: '+33', flag: '🇫🇷', maxLen: 10 },
  { code: 'DE', dialCode: '+49', flag: '🇩🇪', maxLen: 12 },
  { code: 'ES', dialCode: '+34', flag: '🇪🇸', maxLen: 9 },
  // Additional common countries
  { code: 'GB', dialCode: '+44', flag: '🇬🇧', maxLen: 11 },
  { code: 'AU', dialCode: '+61', flag: '🇦🇺', maxLen: 10 },
  { code: 'CA', dialCode: '+1', flag: '🇨🇦', maxLen: 10 },
  { code: 'TW', dialCode: '+886', flag: '🇹🇼', maxLen: 10 },
  { code: 'HK', dialCode: '+852', flag: '🇭🇰', maxLen: 8 },
  { code: 'SG', dialCode: '+65', flag: '🇸🇬', maxLen: 8 },
  { code: 'TH', dialCode: '+66', flag: '🇹🇭', maxLen: 10 },
  { code: 'VN', dialCode: '+84', flag: '🇻🇳', maxLen: 10 },
  { code: 'PH', dialCode: '+63', flag: '🇵🇭', maxLen: 10 },
  { code: 'IN', dialCode: '+91', flag: '🇮🇳', maxLen: 10 },
];

interface PhoneInputProps {
  value: string;           // E.164 or local format
  onChange: (e164: string, display: string) => void;  // e164 for API, display for UI
  placeholder?: string;
  required?: boolean;
  className?: string;
}

/**
 * Returns the default country code based on the user's locale
 */
function getDefaultCountry(locale: string): string {
  return LOCALE_TO_COUNTRY[locale] || 'KR';
}

/**
 * Format a Korean phone number: 010-1234-5678
 */
function formatKoreanPhone(digits: string): string {
  if (digits.startsWith('0')) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  return digits;
}

export default function PhoneInput({
  value,
  onChange,
  placeholder,
  required,
  className = '',
}: PhoneInputProps) {
  const locale = useLocale();
  const t = useTranslations('phone');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine initial country from locale
  const defaultCountry = getDefaultCountry(locale);
  const [selectedCountry, setSelectedCountry] = useState(() => {
    // If value starts with +, try to parse country from it
    if (value.startsWith('+')) {
      const found = COUNTRY_CALLING_CODES.find(c => value.startsWith(c.dialCode));
      if (found) return found.code;
    }
    return defaultCountry;
  });
  const [localNumber, setLocalNumber] = useState(() => {
    // Strip dial code from value if present
    if (value.startsWith('+')) {
      const country = COUNTRY_CALLING_CODES.find(c => value.startsWith(c.dialCode));
      if (country) {
        return value.slice(country.dialCode.length);
      }
    }
    return value.replace(/[^0-9]/g, '');
  });

  const selectedCountryData = COUNTRY_CALLING_CODES.find(c => c.code === selectedCountry) || COUNTRY_CALLING_CODES[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCountrySelect = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setShowDropdown(false);
    // Re-emit with new dial code
    const country = COUNTRY_CALLING_CODES.find(c => c.code === countryCode)!;
    const digits = localNumber.replace(/[^0-9]/g, '');
    const cleanDigits = digits.startsWith('0') ? digits.slice(1) : digits;
    const e164 = `${country.dialCode}${cleanDigits}`;
    onChange(e164, localNumber);
  };

  const handleNumberChange = (input: string) => {
    // Only allow digits and dashes
    const cleaned = input.replace(/[^0-9-]/g, '');
    const digits = cleaned.replace(/-/g, '');

    // Enforce max length
    if (digits.length > selectedCountryData.maxLen) return;

    // Format display for Korean numbers
    let display = cleaned;
    if (selectedCountry === 'KR') {
      display = formatKoreanPhone(digits);
    }

    setLocalNumber(display);

    // Build E.164
    const cleanDigits = digits.startsWith('0') ? digits.slice(1) : digits;
    const e164 = `${selectedCountryData.dialCode}${cleanDigits}`;
    onChange(e164, display);
  };

  // Sorted countries: priority first, then rest
  const sortedCountries = [
    ...COUNTRY_CALLING_CODES.filter(c => PRIORITY_COUNTRIES.includes(c.code)),
    ...COUNTRY_CALLING_CODES.filter(c => !PRIORITY_COUNTRIES.includes(c.code)),
  ];

  const defaultPlaceholder = selectedCountry === 'KR' ? '010-1234-5678' : '';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="flex w-full">
        {/* Country code selector button */}
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1 px-2 py-2 border border-r-0 rounded-l-lg bg-gray-50 hover:bg-gray-100 text-sm whitespace-nowrap"
          aria-label={t('countryCode')}
        >
          <span>{selectedCountryData.flag}</span>
          <span className="text-gray-600">{selectedCountryData.dialCode}</span>
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Phone number input */}
        <input
          type="tel"
          value={localNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder || defaultPlaceholder}
          required={required}
          className="flex-1 min-w-0 border rounded-r-lg px-3 py-2"
        />
      </div>

      {/* Country dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {sortedCountries.map((country, idx) => (
            <button
              key={`${country.code}-${idx}`}
              type="button"
              onClick={() => handleCountrySelect(country.code)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                country.code === selectedCountry ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <span>{country.flag}</span>
              <span className="flex-1 text-left">{country.code}</span>
              <span className="text-gray-400">{country.dialCode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
