import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '한경 음식배달',
  description: '제주 한경면 음식배달 서비스',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
