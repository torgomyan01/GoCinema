import { unstable_noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import TicketPrintClient from '@/components/admin/ticket-print-client';
import { getBoxOfficeTicketOrderForPrint } from '@/app/actions/box-office';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';
import { formatDateTimeHy } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BoxOfficeSalePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/account');
  const user = session.user as { role?: string };
  if (!isStaffRole(user?.role)) redirect('/account');

  const { id } = await params;
  const orderId = Number(id);
  const result = await getBoxOfficeTicketOrderForPrint(orderId);

  if (!result.success || !result.print) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        Պատվերը չի գտնվել։
      </div>
    );
  }

  const p = result.print;
  const firstSeat = p.seats[0]!;

  return (
    <TicketPrintClient
      ticket={{
        id: p.orderId,
        orderId: p.orderId,
        price: firstSeat.price,
        qrCode: p.qrCode,
        formattedStartTime: formatDateTimeHy(p.screening.startTime),
        seat: {
          row: firstSeat.row,
          number: firstSeat.number,
          seatType: firstSeat.seatType,
        },
        screening: { movie: p.screening.movie },
        total: p.total,
      }}
    />
  );
}
