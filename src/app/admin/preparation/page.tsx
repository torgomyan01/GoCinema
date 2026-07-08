import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AdminPreparationClient from '@/components/admin/admin-preparation-client';
import { authOptions } from '@/lib/auth';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function AdminPreparationPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/account');
  }

  if (!isAdminRole(session.user.role)) {
    redirect('/account');
  }

  return (
    <AdminPreparationClient
      user={{
        id: session.user.id,
        name: session.user.name || null,
        email: session.user.email || null,
        phone: session.user.phone || null,
        role: session.user.role,
      }}
    />
  );
}
