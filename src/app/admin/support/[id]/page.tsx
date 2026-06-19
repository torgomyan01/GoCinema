import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import AdminSupportClient from '@/components/admin/admin-support-client';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Աջակցության հարցում - Ադմինիստրատոր - GoCinema',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminSupportDetailPage({ params }: PageProps) {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/account');

  const user = session.user as any;
  if (!isStaffRole(user?.role)) redirect('/account');

  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isFinite(requestId)) redirect('/admin/support');

  const adminUser = {
    id: user.id,
    name: user.name || null,
    email: user.email || null,
    phone: user.phone || null,
    role: user.role,
  };

  return (
    <AdminLayout user={adminUser}>
      <AdminSupportClient initialRequestId={requestId} />
    </AdminLayout>
  );
}

