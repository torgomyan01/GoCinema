import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AdminLayout from '@/components/admin/admin-layout';
import AdminSmmPremiereClient from '@/components/admin/admin-smm-premiere-client';
import { getSmmPremieres } from '@/app/actions/instagram-story';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Պրեմիերա · SMM - Ադմինիստրատոր - GoCinema',
};

export default async function AdminSmmPremierePage() {
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

  if (!isAdminRole(user.role)) redirect('/account');

  const data = await getSmmPremieres();

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
      <AdminSmmPremiereClient
        initialPremieres={data.success ? data.premieres : []}
        initialError={data.success ? null : data.error}
      />
    </AdminLayout>
  );
}
