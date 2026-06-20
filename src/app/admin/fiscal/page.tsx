import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import FiscalClient from '@/components/admin/fiscal-client';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'ՀԴՄ չեկեր - Ադմինիստրատոր - GoCinema',
};

export default async function AdminFiscalPage() {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/account');

  const user = session.user as any;
  if (!isStaffRole(user?.role)) redirect('/account');

  const adminUser = {
    id: user.id,
    name: user.name || null,
    email: user.email || null,
    phone: user.phone || null,
    role: user.role,
  };

  return (
    <AdminLayout user={adminUser}>
      <FiscalClient />
    </AdminLayout>
  );
}
