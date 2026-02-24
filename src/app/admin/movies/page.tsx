import AdminMoviesClient from '@/components/admin/admin-movies-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Ֆիլմեր - Ադմինիստրատոր - GoCinema',
  description: 'Կառավարել ֆիլմերը',
};

export default async function AdminMoviesPage() {
  unstable_noStore();

  // Check if user is authenticated and has admin role
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/account');
  }

  const user = session.user as any;
  if (user?.role !== 'admin') {
    redirect('/account');
  }

  return <AdminMoviesClient user={user} />;
}
