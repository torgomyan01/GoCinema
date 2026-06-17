import './globals.scss';
import '../icons/icons.css';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import './tailwind.css';

import NextTopLoader from 'nextjs-toploader';
import { Noto_Sans_Armenian, Roboto } from 'next/font/google';

import { Providers } from '@/app/providers';

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hy"
      suppressHydrationWarning={true}
      className={`${roboto.variable} ${notoSansArmenian.variable} font-sans light`}
    >
      <body className="text-foreground bg-background antialiased">
        <NextTopLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
