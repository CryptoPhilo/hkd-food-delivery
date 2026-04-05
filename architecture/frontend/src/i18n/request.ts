import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { locales, defaultLocale, Locale } from './config';

function resolveLocale(acceptLanguage: string | null, cookieLocale: string | null): Locale {
  // Priority 1: Cookie (user's explicit choice)
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  // Priority 2: Accept-Language header (browser/system language)
  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(',')
      .map(lang => {
        const [code, q] = lang.trim().split(';q=');
        return { code: code.split('-')[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { code } of preferred) {
      if (locales.includes(code as Locale)) {
        return code as Locale;
      }
    }
  }

  // Priority 3: Default (English)
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const headerStore = headers();

  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value ?? null;
  const acceptLanguage = headerStore.get('accept-language') ?? null;
  const locale = resolveLocale(acceptLanguage, cookieLocale);

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
