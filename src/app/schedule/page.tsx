import MainTemplate from '@/components/layout/main-template/main-template';
import SchedulePageClient from '@/components/schedule/schedule-page-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Ժամանակացույց - GoCinema',
  description:
    'Դիտեք բոլոր ցուցադրությունների ժամանակացույցը և ամրագրեք տոմսեր',
};

export default async function SchedulePage() {
  unstable_noStore();

  // TODO: Fetch from database when Screening model is ready
  // const screenings = await prisma.screening.findMany({
  //   where: {
  //     isActive: true,
  //     startTime: { gte: new Date() },
  //   },
  //   include: {
  //     movie: true,
  //     hall: true,
  //   },
  //   orderBy: { startTime: 'asc' },
  // });

  return (
    <MainTemplate>
      <SchedulePageClient />
    </MainTemplate>
  );
}
