import './globals.scss';
import '../icons/icons.css';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import './tailwind.css';

import NextTopLoader from 'nextjs-toploader';

import { Providers } from '@/app/providers';


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning={true} className="light">
      <body className="text-foreground bg-background">
        <NextTopLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
