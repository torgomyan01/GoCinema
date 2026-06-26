import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import TicketPrintClient from '@/components/admin/ticket-print-client';
import { getTicketById } from '@/app/actions/tickets';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BoxOfficePrintPage({
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
  const ticketId = Number(id);
  const result = await getTicketById(ticketId);

  if (!result.success || !result.ticket) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        Տոմսը չի գտնվել։
      </div>
    );
  }

  const t = result.ticket;
  const items = (t.order?.orderItems ?? []).map((item) => ({
    name: item.product?.name ?? 'Ապրանք',
    quantity: item.quantity,
    price: item.price,
  }));
  const productsTotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const ticket = {
    id: t.id,
    price: t.price,
    qrCode: t.qrCode || `TICKET-${t.id}`,
    seat: { row: t.seat.row, number: t.seat.number, seatType: t.seat.seatType },
    screening: {
      startTime:
        typeof t.screening.startTime === 'string'
          ? t.screening.startTime
          : t.screening.startTime.toISOString(),
      movie: { title: t.screening.movie.title },
      hall: { name: t.screening.hall.name },
    },
    items,
    total: t.price + productsTotal,
    payment: t.payment
      ? {
          method: t.payment.method,
          amountPaid: t.payment.amountPaid ?? null,
        }
      : null,
  };

  return <TicketPrintClient ticket={ticket} />;
}
