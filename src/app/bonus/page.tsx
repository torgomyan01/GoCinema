import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { Suspense } from 'react';
import MainTemplate from '@/components/layout/main-template/main-template';
import BonusPageClient from '@/components/bonus/bonus-page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Իմ բոնուսները - GoCinema',
  description: 'Բոնուսային միավորներ, մակարդակ, պարգևներ և հրավերի կոդ',
};

export default async function BonusPage() {
  unstable_noStore();

  return (
    <MainTemplate>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            Բեռնվում է...
          </div>
        }
      >
        <BonusPageClient />
      </Suspense>
    </MainTemplate>
  );
}
