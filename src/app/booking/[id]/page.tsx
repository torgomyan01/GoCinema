import MainTemplate from '@/components/layout/main-template/main-template';
import BookingPageClient from '@/components/booking/booking-page-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Տոմսերի ամրագրում - GoCinema',
  description: 'Ընտրեք նստատեղերը և ամրագրեք ձեր տոմսերը',
};

interface BookingPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BookingPage({ params }: BookingPageProps) {
  unstable_noStore();

  const { id } = await params;

  // TODO: Fetch from database when Screening model is ready
  // const screening = await prisma.screening.findUnique({
  //   where: { id: parseInt(id) },
  //   include: {
  //     movie: true,
  //     hall: {
  //       include: {
  //         seats: {
  //           orderBy: [
  //             { row: 'asc' },
  //             { number: 'asc' },
  //           ],
  //         },
  //       },
  //     },
  //     tickets: {
  //       where: {
  //         status: { in: ['reserved', 'paid'] },
  //       },
  //       select: {
  //         seatId: true,
  //       },
  //     },
  //   },
  // });

  return (
    <MainTemplate>
      <BookingPageClient screeningId={id} />
    </MainTemplate>
  );
}
