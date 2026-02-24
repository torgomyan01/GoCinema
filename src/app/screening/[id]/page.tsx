import MainTemplate from '@/components/layout/main-template/main-template';
import ScreeningDetailPageClient from '@/components/screening/screening-detail-page-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Ցուցադրության մանրամասներ - GoCinema',
  description: 'Դիտեք ցուցադրության մանրամասները և ամրագրեք տոմսեր',
};

interface ScreeningDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ScreeningDetailPage({ params }: ScreeningDetailPageProps) {
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
  //       include: {
  //         user: {
  //           select: {
  //             id: true,
  //             name: true,
  //           },
  //         },
  //         seat: true,
  //       },
  //     },
  //   },
  // });

  return (
    <MainTemplate>
      <ScreeningDetailPageClient screeningId={id} />
    </MainTemplate>
  );
}
