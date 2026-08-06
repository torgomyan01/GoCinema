import { Suspense } from 'react';
import MainTemplate from '@/components/layout/main-template/main-template';
import RegisterPageClient from '@/components/account/register-page-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Գրանցում - GoCinema',
  description: 'Ստեղծեք նոր GoCinema հաշիվ',
};

export default async function RegisterPage() {
  unstable_noStore();

  return (
    <MainTemplate>
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center pt-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
          </div>
        }
      >
        <RegisterPageClient />
      </Suspense>
    </MainTemplate>
  );
}
