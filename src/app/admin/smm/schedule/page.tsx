import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AdminLayout from '@/components/admin/admin-layout';
import AdminInstagramClient from '@/components/admin/admin-instagram-client';
import { getInstagramStoryMovies } from '@/app/actions/instagram-story';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Ժամանակացույց · SMM - Ադմինիստրատոր - GoCinema',
};

export default async function AdminSmmSchedulePage() {
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

  const story = await getInstagramStoryMovies();

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
      <AdminInstagramClient
        initialMovies={story.success ? story.movies : []}
        initialError={story.success ? null : story.error}
      />
    </AdminLayout>
  );
}
