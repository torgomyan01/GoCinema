import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AdminProductsClient from '@/components/admin/admin-products-client';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/account');
  }

  const user = session.user as any;
  if (user?.role !== 'admin') {
    redirect('/account');
  }

  return (
    <AdminProductsClient
      user={{
        id: user.id,
        name: user.name || null,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role,
      }}
    />
  );
}
