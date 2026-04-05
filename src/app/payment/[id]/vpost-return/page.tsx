import MainTemplate from '@/components/layout/main-template/main-template';
import VpostReturnClient from '@/components/payment/vpost-return-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Վճարման հաստատում - GoCinema',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VpostReturnPage({ params }: PageProps) {
  unstable_noStore();
  const { id } = await params;

  return (
    <MainTemplate>
      <div className="pt-24 pb-20">
        <VpostReturnClient orderId={id} />
      </div>
    </MainTemplate>
  );
}
