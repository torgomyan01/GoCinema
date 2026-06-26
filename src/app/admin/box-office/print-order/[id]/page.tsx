import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import OrderPrintClient from '@/components/admin/order-print-client';
import { getBoxOfficeOrder } from '@/app/actions/box-office';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BoxOfficeOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/account');
  const user = session.user as any;
  if (!isStaffRole(user?.role)) redirect('/account');

  const { id } = await params;
  const result = await getBoxOfficeOrder(Number(id));

  if (!result.success || !result.order) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        Պատվերը չի գտնվել։
      </div>
    );
  }

  const o = result.order;
  const items = (o.orderItems ?? []).map((item) => ({
    name: item.product?.name ?? 'Ապրանք',
    quantity: item.quantity,
    price: item.price,
  }));

  const order = {
    id: o.id,
    createdAt:
      typeof o.createdAt === 'string' ? o.createdAt : o.createdAt.toISOString(),
    items,
    total: o.totalAmount,
    paymentMethod: o.paymentMethod,
    amountPaid: o.amountPaid ?? null,
  };

  return <OrderPrintClient order={order} />;
}
