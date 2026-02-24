import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import AdminPremieresClient from '@/components/admin/admin-premieres-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Պրեմիերաներ - Ադմինիստրատոր - GoCinema',
};

export default async function AdminPremieresPage() {
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
      <AdminPremieresClient
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
