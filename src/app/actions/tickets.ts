'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import {
  occupiedTicketWhere,
  onlineHoldUntil,
  expiredAwaitingPaymentWhere,
  AWAITING_PAYMENT_STATUS,
} from '@/lib/reservation';

/**
 * Չեղարկում է լրացած օնլայն վճարման hold-ները (`awaiting_payment` + holdUntil <= now)։
 * Դրամարկղ `reserved` տոմսերին չի դիպչում։
 */
export async function releaseExpiredReservations(screeningId?: number) {
  const now = new Date();
  const where = {
    ...expiredAwaitingPaymentWhere(now),
    ...(screeningId != null ? { screeningId } : {}),
  };

  const expired = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      orderId: true,
      holdUntil: true,
      payment: { select: { method: true, transactionId: true } },
    },
  });

  if (expired.length === 0) return 0;

  const cardOrderIds = Array.from(
    new Set(
      expired
        .filter(
          (ticket) =>
            ticket.orderId != null &&
            ticket.payment?.method === 'card' &&
            Boolean(ticket.payment.transactionId)
        )
        .map((ticket) => ticket.orderId as number)
    )
  );

  const protectTicketIds = new Set<number>();
  if (cardOrderIds.length > 0) {
    try {
      const { syncVPostOrderStatus } = await import('@/app/actions/payments');
      for (const orderId of cardOrderIds) {
        try {
          const result = await syncVPostOrderStatus({ orderId });
          if (!result.success) {
            expired
              .filter((ticket) => ticket.orderId === orderId)
              .forEach((ticket) => protectTicketIds.add(ticket.id));
          }
        } catch (error) {
          console.error(
            '[releaseExpiredReservations] vPost sync failed:',
            orderId,
            error
          );
          expired
            .filter((ticket) => ticket.orderId === orderId)
            .forEach((ticket) => protectTicketIds.add(ticket.id));
        }
      }
    } catch (error) {
      console.error('[releaseExpiredReservations] vPost import failed:', error);
      expired
        .filter((ticket) => ticket.payment?.method === 'card')
        .forEach((ticket) => protectTicketIds.add(ticket.id));
    }
  }

  const CARD_GRACE_MS = 2 * 60 * 60 * 1000;
  const stillExpired = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      orderId: true,
      holdUntil: true,
      payment: { select: { method: true, transactionId: true } },
    },
  });

  const toCancel = stillExpired.filter((ticket) => {
    if (protectTicketIds.has(ticket.id)) return false;
    const isCardAttempt =
      ticket.payment?.method === 'card' && Boolean(ticket.payment.transactionId);
    if (!isCardAttempt) return true;
    const holdEnd = ticket.holdUntil
      ? new Date(ticket.holdUntil).getTime()
      : 0;
    return holdEnd > 0 && now.getTime() - holdEnd >= CARD_GRACE_MS;
  });

  if (toCancel.length === 0) return 0;

  const ticketIds = toCancel.map((t) => t.id);
  const orderIds = Array.from(
    new Set(
      toCancel
        .map((t) => t.orderId)
        .filter((id): id is number => id != null)
    )
  );

  await prisma.$transaction(async (tx) => {
    await tx.ticket.updateMany({
      where: { id: { in: ticketIds } },
      data: { status: 'cancelled' },
    });

    await tx.payment.updateMany({
      where: {
        ticketId: { in: ticketIds },
        status: 'pending',
      },
      data: { status: 'failed' },
    });

    // Եթե պատվերի բոլոր տոմսերը չեղարկված/failed են — պատվերը նույնպես failed
    for (const orderId of orderIds) {
      const remaining = await tx.ticket.count({
        where: {
          orderId,
          status: { notIn: ['cancelled'] },
        },
      });
      if (remaining === 0) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'failed' },
        });
      }
    }
  });

  revalidatePath('/tickets');
  revalidatePath('/booking');
  revalidatePath('/payment');
  revalidatePath('/admin/tickets');

  return expired.length;
}

export interface CreateTicketData {
  userId: number;
  screeningId: number;
  seatId: number;
  price: number;
}

export interface CreateMultipleTicketsData {
  userId: number;
  screeningId: number;
  seats: Array<{
    seatId: number;
    price: number;
  }>;
}

export async function getAllTicketsForAdmin() {
  try {
    const tickets = await prisma.ticket.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        screening: {
          include: {
            movie: true,
            hall: true,
          },
        },
        seat: {
          select: {
            id: true,
            row: true,
            number: true,
            seatType: true,
          },
        },
        orderItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      tickets,
    };
  } catch (error: any) {
    console.error('[Get All Tickets For Admin] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել',
      tickets: [],
    };
  }
}

export async function getUserTickets(userId: number) {
  try {
    // Validate userId
    if (!userId || isNaN(Number(userId))) {
      return {
        success: false,
        error: 'Օգտատիրոջ ID-ն վավեր չէ',
        tickets: [],
      };
    }

    const pendingCardOrderIds = Array.from(
      new Set(
        (
          await prisma.ticket.findMany({
            where: {
              userId: Number(userId),
              status: AWAITING_PAYMENT_STATUS,
              payment: {
                is: {
                  method: 'card',
                  transactionId: { not: null },
                },
              },
            },
            select: { orderId: true },
            take: 10,
          })
        )
          .map((ticket) => ticket.orderId)
          .filter((id): id is number => id != null)
      )
    );

    if (pendingCardOrderIds.length > 0) {
      try {
        const { syncVPostOrderStatus } = await import('@/app/actions/payments');
        for (const orderId of pendingCardOrderIds) {
          await syncVPostOrderStatus({ orderId });
        }
      } catch (error) {
        console.error('[Get User Tickets] vPost sync failed:', error);
      }
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        userId: Number(userId),
      },
      include: {
        screening: {
          include: {
            movie: true,
            hall: true,
          },
        },
        seat: true,
        payment: true,
        order: {
          include: {
            orderItems: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: {
        screening: {
          startTime: 'desc',
        },
      },
    });

    return {
      success: true,
      tickets,
    };
  } catch (error: any) {
    console.error('[Get User Tickets] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել',
      tickets: [],
    };
  }
}

export async function getTicketById(id: number) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        screening: {
          include: {
            movie: true,
            hall: true,
          },
        },
        seat: true,
        payment: true,
        order: {
          include: {
            orderItems: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      return {
        success: false,
        error: 'Տոմսը չի գտնվել',
      };
    }

    return { success: true, ticket };
  } catch (error: any) {
    console.error('[Get Ticket] Error:', error);
    return {
      success: false,
      error: 'Տոմսը բեռնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function createTicket(data: CreateTicketData) {
  try {
    // Validation
    if (!data.userId || !data.screeningId || !data.seatId) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Legacy hook է. reserved տոմսերը ավտոմատ չեն ազատվում։
    await releaseExpiredReservations(data.screeningId);

    try {
      const ticket = await prisma.$transaction(
        async (tx) => {
          const existingTicket = await tx.ticket.findFirst({
            where: {
              screeningId: data.screeningId,
              seatId: data.seatId,
              ...occupiedTicketWhere(),
            },
          });

          if (existingTicket) {
            throw new Error('SEAT_TAKEN');
          }

          return tx.ticket.create({
            data: {
              userId: data.userId,
              screeningId: data.screeningId,
              seatId: data.seatId,
              price: data.price,
              status: AWAITING_PAYMENT_STATUS,
              holdUntil: onlineHoldUntil(),
            },
            include: {
              screening: {
                include: {
                  movie: true,
                  hall: true,
                },
              },
              seat: true,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        }
      );

      revalidatePath('/tickets');
      revalidatePath('/booking');

      return {
        success: true,
        ticket,
        message: 'Տոմսը հաջողությամբ ամրագրվեց',
      };
    } catch (inner: unknown) {
      if (inner instanceof Error && inner.message === 'SEAT_TAKEN') {
        return {
          success: false,
          error: 'Այս նստատեղը արդեն զբաղված է',
        };
      }
      // Serializable conflict — retry-friendly message
      const code =
        inner && typeof inner === 'object' && 'code' in inner
          ? String((inner as { code: unknown }).code)
          : '';
      if (code === 'P2034') {
        return {
          success: false,
          error: 'Այս նստատեղը արդեն զբաղված է',
        };
      }
      throw inner;
    }
  } catch (error: any) {
    console.error('[Create Ticket] Error:', error);
    return {
      success: false,
      error: 'Տոմս ամրագրելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function createMultipleTickets(data: CreateMultipleTicketsData) {
  try {
    // Validation
    if (!data.userId || !data.screeningId || !data.seats.length) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Legacy hook է. reserved տոմսերը ավտոմատ չեն ազատվում։
    await releaseExpiredReservations(data.screeningId);

    const seatIds = data.seats.map((s) => s.seatId);
    const holdUntil = onlineHoldUntil();

    try {
      const count = await prisma.$transaction(
        async (tx) => {
          const existingTickets = await tx.ticket.findMany({
            where: {
              screeningId: data.screeningId,
              seatId: { in: seatIds },
              ...occupiedTicketWhere(),
            },
          });

          if (existingTickets.length > 0) {
            throw new Error('SEAT_TAKEN');
          }

          const created = await tx.ticket.createMany({
            data: data.seats.map((seat) => ({
              userId: data.userId,
              screeningId: data.screeningId,
              seatId: seat.seatId,
              price: seat.price,
              status: AWAITING_PAYMENT_STATUS,
              holdUntil,
            })),
          });

          return created.count;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        }
      );

      revalidatePath('/tickets');
      revalidatePath('/booking');

      return {
        success: true,
        count,
        message: `${count} տոմս հաջողությամբ ամրագրվեց`,
      };
    } catch (inner: unknown) {
      if (inner instanceof Error && inner.message === 'SEAT_TAKEN') {
        return {
          success: false,
          error: 'Որոշ նստատեղեր արդեն զբաղված են, խնդրում ենք ընտրել այլ տեղ',
        };
      }
      const code =
        inner && typeof inner === 'object' && 'code' in inner
          ? String((inner as { code: unknown }).code)
          : '';
      if (code === 'P2034') {
        return {
          success: false,
          error: 'Որոշ նստատեղեր արդեն զբաղված են, խնդրում ենք ընտրել այլ տեղ',
        };
      }
      throw inner;
    }
  } catch (error: any) {
    console.error('[Create Multiple Tickets] Error:', error);
    return {
      success: false,
      error: 'Տոմսեր ամրագրելիս սխալ է տեղի ունեցել',
    };
  }
}

/** Ֆիլմի բոլոր ցուցադրությունները՝ տոմսերի ամփոփ վիճակագրությամբ (admin) */
export async function getScreeningsForMovieAdmin(movieId: number) {
  try {
    // Legacy hook է. պահում ենք call-ը համատեղելիության համար։
    await releaseExpiredReservations();

    const screenings = await prisma.screening.findMany({
      where: { movieId },
      orderBy: { startTime: 'desc' },
      include: {
        hall: { select: { id: true, name: true, capacity: true } },
        tickets: { select: { status: true, price: true } },
      },
    });

    const data = screenings.map((s) => {
      const counts = {
        reserved: 0,
        awaiting_payment: 0,
        paid: 0,
        used: 0,
        cancelled: 0,
      };
      let revenue = 0;
      for (const t of s.tickets) {
        if (t.status in counts) {
          counts[t.status as keyof typeof counts] += 1;
        }
        if (t.status === 'paid' || t.status === 'used') revenue += t.price;
      }
      const sold = counts.paid + counts.used;
      return {
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        price: s.basePrice,
        hallId: s.hall?.id ?? null,
        hallName: s.hall?.name ?? '—',
        capacity: s.hall?.capacity ?? 0,
        totalTickets: s.tickets.length,
        sold,
        counts,
        revenue,
      };
    });

    return { success: true, screenings: data };
  } catch (error: any) {
    console.error('[Get Screenings For Movie Admin] Error:', error);
    return {
      success: false,
      error: 'Ցուցադրությունները բեռնելիս սխալ է տեղի ունեցել',
      screenings: [],
    };
  }
}

/** Ցուցադրության բոլոր տոմսերը (բոլոր կարգավիճակներով)՝ ադմինի կառավարման համար */
export async function getTicketsForScreeningAdmin(screeningId: number) {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { screeningId },
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
        seat: {
          select: { id: true, row: true, number: true, seatType: true },
        },
        order: { select: { id: true, paymentMethod: true } },
      },
      orderBy: [
        { seat: { row: 'asc' } },
        { seat: { number: 'asc' } },
        { id: 'asc' },
      ],
    });

    return { success: true, tickets };
  } catch (error: any) {
    console.error('[Get Tickets For Screening Admin] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել',
      tickets: [],
    };
  }
}

export async function updateTicketStatus(
  id: number,
  status: 'reserved' | 'awaiting_payment' | 'paid' | 'used' | 'cancelled'
) {
  try {
    const ticket = await prisma.ticket.update({
      where: { id },
      data: { status },
      include: {
        screening: {
          include: {
            movie: true,
            hall: true,
          },
        },
        seat: true,
      },
    });

    revalidatePath('/tickets');
    revalidatePath('/payment');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/movies');

    return {
      success: true,
      ticket,
      message: 'Տոմսի կարգավիճակը հաջողությամբ թարմացվեց',
    };
  } catch (error: any) {
    console.error('[Update Ticket Status] Error:', error);
    return {
      success: false,
      error: 'Տոմսի կարգավիճակը թարմացնելիս սխալ է տեղի ունեցել',
    };
  }
}

/** Payload must match `getOrderOrTicketByQR` (ORDER-n / TICKET-n). */
export async function generateQRCode(ticketId: number): Promise<string> {
  try {
    const qrCode = `TICKET-${ticketId}`;

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { qrCode },
    });

    revalidatePath('/tickets');
    revalidatePath('/payment');

    return qrCode;
  } catch (error: any) {
    console.error('[Generate QR Code] Error:', error);
    throw new Error('QR կոդ ստեղծելիս սխալ է տեղի ունեցել');
  }
}
