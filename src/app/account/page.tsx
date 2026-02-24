import MainTemplate from '@/components/layout/main-template/main-template';
import LoginPageClient from '@/components/account/login-page-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Մուտք - GoCinema',
  description: 'Մուտք գործեք ձեր հաշիվ',
};

export default async function AccountPage() {
  unstable_noStore();

  return (
    <MainTemplate>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            Բեռնվում է...
          </div>
        }
      >
        <LoginPageClient />
      </Suspense>
    </MainTemplate>
  );
}
