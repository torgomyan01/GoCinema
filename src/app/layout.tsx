import './globals.scss';
import '../icons/icons.css';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import './tailwind.css';

import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import NextTopLoader from 'nextjs-toploader';
import { Noto_Sans_Armenian, Roboto } from 'next/font/google';

import { Providers } from '@/app/providers';
import GoogleAnalytics from '@/components/google-analytics';
import { auth } from '@/auth';

const roboto = Roboto({
  weight: ['100', '300', '400', '500', '700', '900'],
  subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext', 'vietnamese'],
  display: 'swap',
  variable: '--font-roboto',
});

const notoSansArmenian = Noto_Sans_Armenian({
  weight: ['100', '300', '400', '500', '700', '900'],
  subsets: ['armenian'],
  display: 'swap',
  variable: '--font-noto-armenian',
});

export const metadata: Metadata = {
  verification: {
    google: 'sIKtSAxr0Ad13m2js8Xwbj0KEGe4DDesqocS3NjrKPo',
    yandex: 'fd366c106ad19775',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Seed SessionProvider from the same server session Header uses,
  // so navbar and /account never disagree after hydration.
  const session = await auth();

  return (
    <html
      lang="hy"
      suppressHydrationWarning={true}
      className={`${roboto.variable} ${notoSansArmenian.variable} font-sans light`}
    >
      <body className="text-foreground bg-background antialiased">
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <NextTopLoader />
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
