import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import AdminFiscalClient from '@/components/admin/admin-fiscal-client';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Ֆիսկալ կտրոններ - Ադմինիստրատոր - GoCinema',
};

export default async function AdminFiscalPage() {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/account');

  const user = session.user as {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
  if (!isStaffRole(user?.role)) redirect('/account');

  return (
    <AdminLayout user={user}>
      <AdminFiscalClient />
    </AdminLayout>
  );
}
