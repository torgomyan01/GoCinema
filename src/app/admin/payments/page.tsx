import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AdminPaymentsClient from '@/components/admin/admin-payments-client';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/account');
  }

  if (session.user.role !== 'admin') {
    redirect('/account');
  }

  return (
    <AdminPaymentsClient
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
