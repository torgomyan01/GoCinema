import AdminDashboardClient from '@/components/admin/admin-dashboard-client';
import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Ադմինիստրատոր - GoCinema',
  description: 'Ադմինիստրատորի վահանակ',
};

export default async function AdminPage() {
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

  return <AdminDashboardClient user={user} />;
}
