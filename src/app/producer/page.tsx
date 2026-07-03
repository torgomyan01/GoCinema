import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import MainTemplate from '@/components/layout/main-template/main-template';
import ProducerMoviesClient from '@/components/producer/producer-movies-client';
import { isAdminRole, isProducerRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Իմ ֆիլմերը - GoCinema',
  description: 'Ֆիլմարտադրողի հաշվետվություններ',
};

export default async function ProducerPage() {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/account');
  }

  const user = session.user as { role?: string };
  if (!isProducerRole(user.role) && !isAdminRole(user.role)) {
    redirect('/account');
  }

  return (
    <MainTemplate>
      <ProducerMoviesClient />
    </MainTemplate>
  );
}
