'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isStaffRole } from '@/lib/roles';

const WALK_IN_PHONE = '000000000';
const WALK_IN_NAME = 'Դրամարկղ (walk-in)';

const ACTIVE_TICKET_STATUSES = ['reserved', 'paid', 'used'];

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isStaffRole(user.role)) {
    return null;
  }
  return user;
}

/** Ընդհանուր «դրամարկղ» օգտատեր՝ բոլոր կանխիկ վաճառքների համար */
async function getOrCreateWalkInUser() {
  const existing = await prisma.user.findUnique({
    where: { phone: WALK_IN_PHONE },
    select: { id: true },
  });
  if (existing) return existing.id;

  const password = await bcrypt.hash(`walk-in-${Date.now()}-${Math.random()}`, 10);
  const created = await prisma.user.create({
    data: {
      name: WALK_IN_NAME,
      phone: WALK_IN_PHONE,
      password,
      role: 'user',
    },
    select: { id: true },
  });
  return created.id;
}

/** Առաջիկա ցուցադրությունները (այսօրվանից) դրամարկղի համար */
export async function getBoxOfficeScreenings() {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', screenings: [] };
  }

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const screenings = await prisma.screening.findMany({
      where: { startTime: { gte: startOfToday } },
      include: {
        movie: { select: { id: true, title: true, image: true, duration: true } },
        hall: { select: { id: true, name: true, capacity: true } },
        tickets: {
          where: { status: { in: ACTIVE_TICKET_STATUSES } },
          select: { id: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const mapped = screenings.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      basePrice: s.basePrice,
      movie: s.movie,
      hall: s.hall,
      soldCount: s.tickets.length,
      capacity: s.hall.capacity,
    }));

    return { success: true, screenings: mapped };
  } catch (error) {
    console.error('[Box Office Screenings] Error:', error);
    return {
      success: false,
      error: 'Ցուցադրությունները բեռնելիս սխալ է տեղի ունեցել',
      screenings: [],
    };
  }
}

/** Դահլիճի նստատեղերի քարտեզը՝ զբաղված տեղերով */
export async function getBoxOfficeSeatMap(screeningId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  try {
    const screening = await prisma.screening.findUnique({
      where: { id: screeningId },
      include: {
        movie: { select: { id: true, title: true, duration: true } },
        hall: {
          include: {
            seats: { orderBy: [{ row: 'asc' }, { number: 'asc' }] },
          },
        },
        tickets: {
          where: { status: { in: ACTIVE_TICKET_STATUSES } },
          select: { seatId: true },
        },
      },
    });

    if (!screening) {
      return { success: false, error: 'Ցուցադրությունը չի գտնվել', data: null };
    }

    const takenSeatIds = new Set(screening.tickets.map((t) => t.seatId));

    return {
      success: true,
      data: {
        id: screening.id,
        startTime: screening.startTime,
        endTime: screening.endTime,
        basePrice: screening.basePrice,
        movie: screening.movie,
        hall: {
          id: screening.hall.id,
          name: screening.hall.name,
          capacity: screening.hall.capacity,
        },
        seats: screening.hall.seats.map((seat) => ({
          id: seat.id,
          row: seat.row,
          number: seat.number,
          seatType: seat.seatType,
          taken: takenSeatIds.has(seat.id),
        })),
      },
    };
  } catch (error) {
    console.error('[Box Office Seat Map] Error:', error);
    return {
      success: false,
      error: 'Նստատեղերը բեռնելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}

/** Բերում է զբաղված նստատեղի տոմսը՝ ինֆո/վերատպելու համար */
export async function getBoxOfficeTicketBySeat(
  screeningId: number,
  seatId: number
) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', ticket: null };
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        screeningId,
        seatId,
        status: { in: ACTIVE_TICKET_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        seat: { select: { row: true, number: true, seatType: true } },
        user: { select: { name: true, phone: true } },
        payment: { select: { method: true, status: true, amount: true } },
        screening: {
          include: {
            movie: { select: { title: true } },
            hall: { select: { name: true } },
          },
        },
      },
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել', ticket: null };
    }

    return { success: true, ticket };
  } catch (error) {
    console.error('[Box Office Ticket By Seat] Error:', error);
    return {
      success: false,
      error: 'Տոմսը բեռնելիս սխալ է տեղի ունեցել',
      ticket: null,
    };
  }
}

export interface CreateBoxOfficeTicketData {
  screeningId: number;
  seatId: number;
  price: number;
}

/** Կանխիկ վաճառք դրամարկղից՝ ստեղծում է վճարված տոմս + Payment + QR */
export async function createBoxOfficeTicket(data: CreateBoxOfficeTicketData) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const { screeningId, seatId } = data;
    const price = Number(data.price);

    if (!screeningId || !seatId || !Number.isFinite(price) || price < 0) {
      return { success: false, error: 'Բոլոր դաշտերը պետք է ճիշտ լրացված լինեն' };
    }

    // Համոզվել՝ նստատեղը ազատ է
    const existing = await prisma.ticket.findFirst({
      where: {
        screeningId,
        seatId,
        status: { in: ACTIVE_TICKET_STATUSES },
      },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: 'Այս նստատեղն արդեն զբաղված է' };
    }

    const walkInUserId = await getOrCreateWalkInUser();

    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          userId: walkInUserId,
          screeningId,
          seatId,
          price,
          status: 'paid',
        },
      });

      const qrCode = `TICKET-${created.id}`;
      await tx.ticket.update({
        where: { id: created.id },
        data: { qrCode },
      });

      await tx.payment.create({
        data: {
          userId: walkInUserId,
          ticketId: created.id,
          amount: price,
          method: 'cash',
          status: 'completed',
          transactionId: `BOXOFFICE-${created.id}`,
        },
      });

      return tx.ticket.findUnique({
        where: { id: created.id },
        include: {
          screening: { include: { movie: true, hall: true } },
          seat: true,
        },
      });
    });

    revalidatePath('/admin/box-office');
    revalidatePath('/admin/tickets');

    return { success: true, ticket };
  } catch (error) {
    console.error('[Create Box Office Ticket] Error:', error);
    return {
      success: false,
      error: 'Տոմս ստեղծելիս սխալ է տեղի ունեցել',
    };
  }
}
