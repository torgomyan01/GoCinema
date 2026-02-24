import MainTemplate from '@/components/layout/main-template/main-template';
import PaymentPageClient from '@/components/payment/payment-page-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Վճարում - GoCinema',
  description: 'Վճարեք ձեր ամրագրված տոմսերի համար',
};

interface PaymentPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PaymentPage({ params }: PaymentPageProps) {
  unstable_noStore();

  const { id } = await params;

  // TODO: Fetch from database when Ticket/Screening model is ready
  // const session = await auth();
  // if (!session?.user) {
  //   redirect('/login');
  // }
  //
  // const ticket = await prisma.ticket.findUnique({
  //   where: { id: parseInt(id) },
  //   include: {
  //     screening: {
  //       include: {
  //         movie: true,
  //         hall: true,
  //       },
  //     },
  //     seat: true,
  //   },
  // });

  return (
    <MainTemplate>
      <PaymentPageClient orderId={id} />
    </MainTemplate>
  );
}
