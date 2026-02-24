import { Metadata } from 'next';
import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import AdminAnalyticsClient from '@/components/admin/admin-analytics-client';
import { getAnalytics } from '@/app/actions/analytics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Վիճակագրություն - Ադմինիստրատոր - GoCinema',
};

export default async function AdminAnalyticsPage() {
  unstable_noStore();

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/account');
  }

  const user = session.user as any;
  if (user?.role !== 'admin') {
    redirect('/account');
  }

  const analyticsResult = await getAnalytics();
  const analytics =
    analyticsResult.success && analyticsResult.analytics
      ? analyticsResult.analytics
      : null;

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
      <AdminAnalyticsClient
        user={{
          id: user.id,
          name: user.name || null,
          email: user.email || null,
          phone: user.phone || null,
          role: user.role,
        }}
        analytics={analytics}
      />
    </AdminLayout>
  );
}
