import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import AdminContactsClient from '@/components/admin/admin-contacts-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Կոնտակտներ - Ադմինիստրատոր - GoCinema',
};

export default async function AdminContactsPage() {
  unstable_noStore();

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/account');
  }

  const user = session.user as any;
  if (user?.role !== 'admin') {
    redirect('/account');
  }

  return (
    <AdminLayout
      user={{
        id: user.id,
        name: user.name || null,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role,
      }}
    >
      <AdminContactsClient
        user={{
          id: user.id,
          name: user.name || null,
          email: user.email || null,
          phone: user.phone || null,
          role: user.role,
        }}
      />
    </AdminLayout>
  );
}
