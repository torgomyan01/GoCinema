import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import MainTemplate from '@/components/layout/main-template/main-template';
import ProducerMovieReportClient from '@/components/producer/producer-movie-report-client';
import { isAdminRole, isProducerRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Ֆիլմի հաշվետվություն - GoCinema',
};

export default async function ProducerMoviePage({
  params,
}: {
  params: Promise<{ movieId: string }>;
}) {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/account');
  }

  const user = session.user as { role?: string };
  if (!isProducerRole(user.role) && !isAdminRole(user.role)) {
    redirect('/account');
  }

  const { movieId } = await params;
  const id = parseInt(movieId, 10);
  if (!Number.isFinite(id)) {
    redirect('/producer');
  }

  return (
    <MainTemplate>
      <ProducerMovieReportClient movieId={id} />
    </MainTemplate>
  );
}
