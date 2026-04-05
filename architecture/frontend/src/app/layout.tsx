import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('home');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const backendUrl = process.env.BACKEND_URL || 'https://hkd-backend.fly.dev';
  const f = await getTranslations('footer');

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            {children}
          </AuthProvider>
          <footer style={{
            background: '#222222', color: '#6a6a6a', textAlign: 'center',
            padding: '24px 20px', fontSize: '12px', marginTop: '40px',
            borderTop: '1px solid #ebebeb',
          }}>
            <p style={{ color: '#6a6a6a' }}>{f('companyInfo')}</p>
            <p style={{ color: '#6a6a6a', marginTop: '4px' }}>{f('contact')}</p>
            <p style={{ marginTop: '12px' }}>
              <a href={`${backendUrl}/terms`} style={{ color: '#ff385c', textDecoration: 'none', margin: '0 8px', fontWeight: 500 }}>{f('terms')}</a> |
              <a href={`${backendUrl}/privacy`} style={{ color: '#ff385c', textDecoration: 'none', margin: '0 8px', fontWeight: 500 }}>{f('privacy')}</a> |
              <a href={`${backendUrl}/refund`} style={{ color: '#ff385c', textDecoration: 'none', margin: '0 8px', fontWeight: 500 }}>{f('refund')}</a>
            </p>
            <p style={{ marginTop: '12px', color: '#6a6a6a' }}>{f('copyright')}</p>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
