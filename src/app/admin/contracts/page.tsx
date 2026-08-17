import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isAdminRole } from '@/lib/roles';
import AdminLayout from '@/components/admin/admin-layout';
import AdminContractsClient from '@/components/admin/admin-contracts-client';
import {
  getLicenseContractOptions,
  getLicenseContracts,
} from '@/app/actions/license-contracts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Պայմանագրեր - Ադմինիստրատոր - GoCinema',
};

export default async function AdminContractsPage() {
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

  const [list, options] = await Promise.all([
    getLicenseContracts(),
    getLicenseContractOptions(),
  ]);

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
      <AdminContractsClient
        initialContracts={list.success ? list.contracts : []}
        initialError={list.success ? null : list.error || null}
        companies={options.success ? options.companies : []}
        movies={options.success ? options.movies : []}
      />
    </AdminLayout>
  );
}
