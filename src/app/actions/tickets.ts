'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  occupiedTicketWhere,
  expiredReservationWhere,
  onlineHoldUntil,
  COUNTER_PAYMENT_METHOD,
} from '@/lib/reservation';

/**
 * Ազատում է լրացած ամրագրումները՝ դրանք cancelled դարձնելով։
 *  - Online ամրագրումներ՝ holdUntil-ից (≈10ր) հետո։
 *  - Դրամարկղ-ամրագրումներ (order.paymentMethod = "counter")՝ ցուցադրության
 *    ավարտից 1 ժամ անց (holdUntil = endTime + 1ժ), որպեսզի ուշացած հաճախորդին
 *    դեռ կարողանանք սպասարկել դրամարկղում։ Դրանք նշվում են որպես `noShow`,
 *    որպեսզի ադմինը կարողանա տեսնել «ամրագրել է, բայց չի եկել» օգտատերերին։
 * Կանչվում է տեղերի հասանելիությունը ստուգելուց առաջ։
 */
export async function releaseExpiredReservations(screeningId?: number) {
  try {
    const expired = await prisma.ticket.findMany({
      where: {
        ...expiredReservationWhere(),
        ...(screeningId ? { screeningId } : {}),
      },
      select: {
        id: true,
        order: { select: { paymentMethod: true } },
      },
    });

    if (expired.length === 0) return 0;

    const counterIds = expired
      .filter((t) => t.order?.paymentMethod === COUNTER_PAYMENT_METHOD)
      .map((t) => t.id);
    const otherIds = expired
      .filter((t) => t.order?.paymentMethod !== COUNTER_PAYMENT_METHOD)
      .map((t) => t.id);

    if (counterIds.length > 0) {
      await prisma.ticket.updateMany({
        where: { id: { in: counterIds } },
        data: { status: 'cancelled', noShow: true },
      });
    }
    if (otherIds.length > 0) {
      await prisma.ticket.updateMany({
        where: { id: { in: otherIds } },
        data: { status: 'cancelled' },
      });
    }

    return expired.length;
  } catch (error) {
    console.error('[Release Expired Reservations] Error:', error);
    return 0;
  }
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

    // Ազատենք լրացած ամրագրումները, ապա ստուգենք զբաղվածությունը
    await releaseExpiredReservations(data.screeningId);

    const existingTicket = await prisma.ticket.findFirst({
      where: {
        screeningId: data.screeningId,
        seatId: data.seatId,
        ...occupiedTicketWhere(),
      },
    });

    if (existingTicket) {
      return {
        success: false,
        error: 'Այս նստատեղը արդեն զբաղված է',
      };
    }

    const ticket = await prisma.ticket.create({
      data: {
        userId: data.userId,
        screeningId: data.screeningId,
        seatId: data.seatId,
        price: data.price,
        status: 'reserved',
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

    revalidatePath('/tickets');
    revalidatePath('/booking');

    return {
      success: true,
      ticket,
      message: 'Տոմսը հաջողությամբ ամրագրվեց',
    };
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

    // Ազատենք լրացած ամրագրումները, ապա ստուգենք զբաղվածությունը
    await releaseExpiredReservations(data.screeningId);

    const seatIds = data.seats.map((s) => s.seatId);
    const existingTickets = await prisma.ticket.findMany({
      where: {
        screeningId: data.screeningId,
        seatId: {
          in: seatIds,
        },
        ...occupiedTicketWhere(),
      },
    });

    if (existingTickets.length > 0) {
      return {
        success: false,
        error: 'Որոշ նստատեղեր արդեն զբաղված են, խնդրում ենք ընտրել այլ տեղ',
      };
    }

    const holdUntil = onlineHoldUntil();
    const tickets = await prisma.ticket.createMany({
      data: data.seats.map((seat) => ({
        userId: data.userId,
        screeningId: data.screeningId,
        seatId: seat.seatId,
        price: seat.price,
        status: 'reserved',
        holdUntil,
      })),
    });

    revalidatePath('/tickets');
    revalidatePath('/booking');

    return {
      success: true,
      count: tickets.count,
      message: `${tickets.count} տոմս հաջողությամբ ամրագրվեց`,
    };
  } catch (error: any) {
    console.error('[Create Multiple Tickets] Error:', error);
    return {
      success: false,
      error: 'Տոմսեր ամրագրելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function updateTicketStatus(
  id: number,
  status: 'reserved' | 'paid' | 'used' | 'cancelled'
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
