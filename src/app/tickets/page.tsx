import MainTemplate from '@/components/layout/main-template/main-template';
import TicketsPageClient from '@/components/tickets/tickets-page-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Իմ տոմսերը - GoCinema',
  description: 'Դիտեք ձեր բոլոր ամրագրված և գնված տոմսերը',
};

export default async function TicketsPage() {
  unstable_noStore();

  // TODO: Fetch from database when Ticket model is ready
  // const session = await auth();
  // if (!session?.user) {
  //   redirect('/login');
  // }
  // 
  // const tickets = await prisma.ticket.findMany({
  //   where: {
  //     userId: session.user.id,
  //   },
  //   include: {
  //     screening: {
  //       include: {
  //         movie: true,
  //         hall: true,
  //       },
  //     },
  //     seat: true,
  //   },
  //   orderBy: {
  //     screening: {
  //       startTime: 'desc',
  //     },
  //   },
  // });

  return (
    <MainTemplate>
      <TicketsPageClient />
    </MainTemplate>
  );
}
