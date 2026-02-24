import MainTemplate from '@/components/layout/main-template/main-template';
import CheckoutPageClient from '@/components/checkout/checkout-page-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Պատվերի ձևակերպում - GoCinema',
  description: 'Ավելացրեք լրացուցիչ արտադրանքներ և ավարտեք պատվերը',
};

interface CheckoutPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  unstable_noStore();

  const { id } = await params;

  return (
    <MainTemplate>
      <CheckoutPageClient orderId={id} />
    </MainTemplate>
  );
}
