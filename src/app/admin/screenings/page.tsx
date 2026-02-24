import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AdminScreeningsClient from '@/components/admin/admin-screenings-client';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminScreeningsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/account');
  }

  if (session.user.role !== 'admin') {
    redirect('/account');
  }

  return (
    <AdminScreeningsClient
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
