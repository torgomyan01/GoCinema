import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AdminProductUnitsClient from '@/components/admin/admin-product-units-client';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminProductUnitsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/account');
  }

  const user = session.user as {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string;
  };

  if (user?.role !== 'admin') {
    redirect('/account');
  }

  return (
    <AdminProductUnitsClient
      user={{
        id: user.id,
        name: user.name || null,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role || 'admin',
      }}
    />
  );
}
