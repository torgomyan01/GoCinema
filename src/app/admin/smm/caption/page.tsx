import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AdminLayout from '@/components/admin/admin-layout';
import AdminSmmCaptionClient from '@/components/admin/admin-smm-caption-client';
import {
  getInstagramStoryMovies,
  getSmmPremieres,
} from '@/app/actions/instagram-story';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Caption · SMM - Ադմինիստրատոր - GoCinema',
};

export default async function AdminSmmCaptionPage() {
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

  const [story, premieres] = await Promise.all([
    getInstagramStoryMovies(),
    getSmmPremieres(),
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
      <AdminSmmCaptionClient
        initialMovies={story.success ? story.movies : []}
        initialPremieres={premieres.success ? premieres.premieres : []}
        initialError={
          story.success
            ? premieres.success
              ? null
              : premieres.error
            : story.error
        }
      />
    </AdminLayout>
  );
}
