'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';
import { COUNTER_PAYMENT_METHOD } from '@/lib/reservation';
import { createNotification, formatAmd } from '@/lib/notifications';

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isStaffRole(user.role)) {
    return null;
  }
  return user;
}

const ORDER_INCLUDE = {
  user: {
    select: { id: true, name: true, phone: true, email: true },
  },
  tickets: {
    include: {
      screening: {
        include: {
          movie: {
            select: { id: true, title: true, image: true, duration: true },
          },
          hall: { select: { id: true, name: true, capacity: true } },
        },
      },
      seat: {
        select: { id: true, row: true, number: true, seatType: true },
      },
      orderItems: {
        include: {
          product: {
            select: { id: true, name: true, price: true, category: true },
          },
        },
      },
    },
  },
} as const;

const TICKET_INCLUDE = {
  user: { select: { id: true, name: true, phone: true, email: true } },
  screening: {
    include: {
      movie: {
        select: { id: true, title: true, image: true, duration: true },
      },
      hall: { select: { id: true, name: true, capacity: true } },
    },
  },
  seat: { select: { id: true, row: true, number: true, seatType: true } },
  order: {
    include: {
      orderItems: {
        include: {
          product: {
            select: { id: true, name: true, price: true, category: true },
          },
        },
      },
    },
  },
} as const;

/**
 * Նորմալիզացնում է սկանավորված/մուտքագրված տվյալը։
 * Բարկոդ-սկաները հաճախ ավելացնում է whitespace/նոր տող, կամ QR-ը կարող է լինել
 * share-հղում (`.../ticket/share?code=TICKET-12`)։ Հանում ենք ORDER-N / TICKET-N
 * կաղապարը ցանկացած ֆորմատից։
 */
function normalizeScanInput(raw: string): {
  type: 'order' | 'ticket' | null;
  id: number | null;
} {
  if (!raw) return { type: null, id: null };
  const text = decodeURIComponent(raw.trim()).toUpperCase();

  const orderMatch = text.match(/ORDER[-\s_]?(\d+)/);
  if (orderMatch) return { type: 'order', id: parseInt(orderMatch[1], 10) };

  const ticketMatch = text.match(/TICKET[-\s_]?(\d+)/);
  if (ticketMatch) return { type: 'ticket', id: parseInt(ticketMatch[1], 10) };

  // Միայն թիվ (օր.՝ «123») — դիտարկում ենք որպես պատվերի համար
  const bareNumber = text.match(/^#?(\d+)$/);
  if (bareNumber) return { type: 'order', id: parseInt(bareNumber[1], 10) };

  return { type: null, id: null };
}

async function fetchOrderData(orderId: number) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
}

export async function getOrderOrTicketByQR(qrData: string) {
  try {
    const { type, id } = normalizeScanInput(qrData);

    if (!type || id === null || isNaN(id)) {
      return {
        success: false,
        error: 'Անվավեր QR կոդ',
        data: null,
      };
    }

    if (type === 'order') {
      const order = await fetchOrderData(id);
      if (!order) {
        return { success: false, error: 'Պատվերը չի գտնվել', data: null };
      }
      return { success: true, type: 'order', data: order };
    }

    // type === 'ticket'
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: TICKET_INCLUDE,
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել', data: null };
    }

    // Եթե տոմսը պատկանում է պատվերի՝ վերադարձնում ենք ամբողջ պատվերը, որպեսզի
    // TICKET-{id} և ORDER-{id} սկանավորումը տան նույն արդյունքը (բոլոր տոմսերը,
    // վճարման պանելը ամրագրումների համար, «նշել որպես օգտագործված» և այլն)։
    if (ticket.orderId) {
      const order = await fetchOrderData(ticket.orderId);
      if (order) {
        return { success: true, type: 'order', data: order };
      }
    }

    return { success: true, type: 'ticket', data: ticket };
  } catch (error: any) {
    console.error('[Get Order/Ticket By QR] Error:', error);
    return {
      success: false,
      error: 'QR կոդը ստուգելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}

export async function markTicketAsUsed(ticketId: number) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return {
        success: false,
        error: 'Տոմսը չի գտնվել',
      };
    }

    if (ticket.status === 'used') {
      return {
        success: false,
        error: 'Տոմսը արդեն օգտագործված է',
      };
    }

    if (ticket.status !== 'paid') {
      return {
        success: false,
        error: 'Տոմսը պետք է լինի վճարված',
      };
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'used' },
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: 'Տոմսը հաջողությամբ նշվեց որպես օգտագործված',
    };
  } catch (error: any) {
    console.error('[Mark Ticket As Used] Error:', error);
    return {
      success: false,
      error: 'Տոմսը նշելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function markAllTicketsInOrderAsUsed(orderId: number) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: true,
      },
    });

    if (!order) {
      return {
        success: false,
        error: 'Պատվերը չի գտնվել',
      };
    }

    const paidTickets = order.tickets.filter((t) => t.status === 'paid');

    if (paidTickets.length === 0) {
      return {
        success: false,
        error: 'Պատվերում վճարված տոմսեր չկան',
      };
    }

    await prisma.ticket.updateMany({
      where: {
        id: {
          in: paidTickets.map((t) => t.id),
        },
        status: 'paid',
      },
      data: { status: 'used' },
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: `${paidTickets.length} տոմս հաջողությամբ նշվեց որպես օգտագործված`,
    };
  } catch (error: any) {
    console.error('[Mark All Tickets As Used] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը նշելիս սխալ է տեղի ունեցել',
    };
  }
}

/**
 * Որոնում է չվճարված ամրագրումներ (դրամարկղում վճարվող)՝ ըստ պատվերի համարի
 * կամ հաճախորդի հեռախոսահամարի։ Օգտագործվում է մուտքի էջում, երբ հաճախորդը
 * չունի QR կամ չի կարող սկանավորել։
 */
export async function findReservations(query: string) {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return { success: false, error: 'Իրավասությունը բավարար չէ', results: [] };
    }

    const q = (query || '').trim();
    if (!q) {
      return { success: false, error: 'Մուտքագրեք որոնման տվյալ', results: [] };
    }

    const where: any = {
      paymentMethod: COUNTER_PAYMENT_METHOD,
      tickets: { some: { status: 'reserved' } },
    };

    // ORDER-N / TICKET-N / մաքուր թիվ → ըստ պատվերի, հակառակ դեպքում՝ ըստ
    // հեռախոսի կամ անվան
    const upper = q.toUpperCase();
    const ticketMatch = upper.match(/TICKET[-\s_]?(\d+)/);
    const orderMatch =
      upper.match(/ORDER[-\s_]?(\d+)/) || q.match(/^#?(\d+)$/);

    if (ticketMatch) {
      const ticket = await prisma.ticket.findUnique({
        where: { id: parseInt(ticketMatch[1], 10) },
        select: { orderId: true },
      });
      where.id = ticket?.orderId ?? -1;
    } else if (orderMatch) {
      where.id = parseInt(orderMatch[1], 10);
    } else {
      const phoneDigits = q.replace(/\D/g, '');
      where.user = {
        is: {
          OR: [
            { phone: { contains: phoneDigits || q } },
            { name: { contains: q } },
          ],
        },
      };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, isBlocked: true } },
        tickets: {
          include: {
            seat: { select: { row: true, number: true } },
            screening: {
              include: { movie: { select: { title: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const results = orders.map((order) => {
      const reserved = order.tickets.filter((t) => t.status === 'reserved');
      const firstScreening = order.tickets[0]?.screening;
      return {
        orderId: order.id,
        qrCode: `ORDER-${order.id}`,
        userName: order.user?.name || null,
        userPhone: order.user?.phone || null,
        isBlocked: order.user?.isBlocked || false,
        movieTitle: firstScreening?.movie?.title || null,
        startTime: firstScreening?.startTime || null,
        seatCount: order.tickets.length,
        reservedCount: reserved.length,
        totalAmount: order.totalAmount,
        status: order.status,
      };
    });

    return { success: true, results };
  } catch (error: any) {
    console.error('[Find Reservations] Error:', error);
    return {
      success: false,
      error: 'Որոնելիս սխալ է տեղի ունեցել',
      results: [],
    };
  }
}

/**
 * Ընդունում է չվճարված ամրագրման վճարումը դրամարկղում/մուտքի մոտ։
 * Բոլոր reserved տոմսերը դառնում են «paid», ստեղծվում են Payment գրառումներ
 * (status: completed)՝ եկամուտը դրամարկղում հաշվելու համար։ Դրանից հետո
 * տոմսերը կարող են նշվել որպես «օգտագործված» (մուտք)։
 */
export async function payReservationAtCounter(input: {
  orderId: number;
  method: 'cash' | 'card';
  amountPaid?: number;
}) {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return { success: false, error: 'Իրավասությունը բավարար չէ' };
    }

    const { orderId } = input;
    const method: 'cash' | 'card' = input.method === 'card' ? 'card' : 'cash';

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: true,
        orderItems: true,
        user: { select: { id: true } },
      },
    });

    if (!order) {
      return { success: false, error: 'Պատվերը չի գտնվել' };
    }

    const reservedTickets = order.tickets.filter(
      (t) => t.status === 'reserved'
    );
    if (reservedTickets.length === 0) {
      return {
        success: false,
        error: 'Այս պատվերում չվճարված ամրագրված տոմսեր չկան',
      };
    }

    const ticketsTotal = reservedTickets.reduce(
      (sum, t) => sum + (t.price || 0),
      0
    );
    const productsTotal = order.orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const grandTotal = ticketsTotal + productsTotal;

    let amountPaid: number | null = grandTotal;
    if (method === 'cash') {
      const received = Number(input.amountPaid);
      if (!Number.isFinite(received) || received < grandTotal) {
        return {
          success: false,
          error: 'Ստացված կանխիկ գումարը չի կարող պակաս լինել ընդհանուր գումարից',
        };
      }
      amountPaid = received;
    }

    await prisma.$transaction(async (tx) => {
      for (const ticket of reservedTickets) {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: 'paid',
            qrCode: ticket.qrCode || `TICKET-${ticket.id}`,
          },
        });

        // Payment գրառում՝ եկամուտի համար (եթե արդեն չկա)
        const existing = await tx.payment.findUnique({
          where: { ticketId: ticket.id },
        });
        if (existing) {
          await tx.payment.update({
            where: { ticketId: ticket.id },
            data: {
              amount: ticket.price,
              method,
              status: 'completed',
              transactionId: `COUNTER-${order.id}-${ticket.id}`,
            },
          });
        } else {
          await tx.payment.create({
            data: {
              userId: ticket.userId,
              ticketId: ticket.id,
              amount: ticket.price,
              method,
              status: 'completed',
              transactionId: `COUNTER-${order.id}-${ticket.id}`,
            },
          });
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          paymentMethod: method,
          amountPaid,
        },
      });
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');
    revalidatePath('/tickets');

    await createNotification({
      type: 'box_office',
      title: 'Դրամարկղ՝ ամրագրման վճարում',
      message: `Պատվեր #${order.id}: ${reservedTickets.length} ամրագրված տոմս վճարվեց (${method === 'cash' ? 'կանխիկ' : 'քարտ'}), ${formatAmd(grandTotal)}`,
      link: '/admin/scanner',
    });
    revalidatePath('/admin/notifications');

    return {
      success: true,
      total: grandTotal,
      amountPaid,
      change: method === 'cash' ? (amountPaid as number) - grandTotal : 0,
      paidCount: reservedTickets.length,
      message: `${reservedTickets.length} տոմս վճարվեց դրամարկղում`,
    };
  } catch (error: any) {
    console.error('[Pay Reservation At Counter] Error:', error);
    return {
      success: false,
      error: 'Վճարումը մշակելիս սխալ է տեղի ունեցել',
    };
  }
}
