'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdminRole, isProducerRole } from '@/lib/roles';
import { isActivePaymentHold } from '@/lib/reservation';

const SOLD_STATUSES = ['paid', 'used'] as const;

export interface ProducerMovieListItem {
  id: number;
  title: string;
  image: string | null;
  isActive: boolean;
  screeningsCount: number;
  upcomingCount: number;
  soldTotal: number;
  revenueTotal: number;
}

export interface ProducerSeatTicket {
  status: 'reserved' | 'awaiting_payment' | 'paid' | 'used' | 'cancelled';
  price: number;
  createdAt: string;
  updatedAt: string;
  holdUntil: string | null;
}

export interface ProducerHallSeat {
  id: number;
  row: string;
  number: number;
  seatType: string;
  ticket: ProducerSeatTicket | null;
}

/** @deprecated օգտագործեք hallSeats */
export interface ProducerSeatInfo {
  row: string;
  number: number;
  seatType: string;
  status: string;
  price: number;
}

export interface ProducerScreeningRow {
  screeningId: number;
  startTime: string;
  endTime: string;
  hallName: string;
  capacity: number;
  sold: number;
  attended: number;
  noShow: number;
  reserved: number;
  cancelled: number;
  revenue: number;
  occupancy: number;
  hallSeats: ProducerHallSeat[];
}

export interface ProducerReportTotals {
  screenings: number;
  capacity: number;
  sold: number;
  attended: number;
  noShow: number;
  reserved: number;
  cancelled: number;
  revenue: number;
  occupancy: number;
}

export interface ProducerMovieReport {
  movie: { id: number; title: string; image: string | null };
  from: string | null;
  to: string | null;
  totals: ProducerReportTotals;
  screenings: ProducerScreeningRow[];
}

async function getSessionUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string | number; role?: string }
    | undefined;
  if (!user?.id) return null;
  const id = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
  if (!Number.isFinite(id)) return null;
  return { id: id as number, role: user.role };
}

/** Ընթացիկ արտադրողին կցված ֆիլմերը (admin-ը տեսնում է իրեն կցվածները) */
export async function getMyProducedMovies(): Promise<{
  success: boolean;
  error: string | null;
  movies: ProducerMovieListItem[];
}> {
  const user = await getSessionUser();
  if (!user || (!isProducerRole(user.role) && !isAdminRole(user.role))) {
    return { success: false, error: 'Մուտքն արգելված է', movies: [] };
  }

  try {
    const now = new Date();
    const movies = await prisma.movie.findMany({
      where: { producers: { some: { id: user.id } } },
      orderBy: { releaseDate: 'desc' },
      select: {
        id: true,
        title: true,
        image: true,
        isActive: true,
        screenings: {
          select: {
            startTime: true,
            tickets: {
              where: { status: { in: [...SOLD_STATUSES] } },
              select: { price: true },
            },
          },
        },
      },
    });

    const list: ProducerMovieListItem[] = movies.map((m) => {
      let soldTotal = 0;
      let revenueTotal = 0;
      let upcomingCount = 0;
      for (const s of m.screenings) {
        if (new Date(s.startTime) >= now) upcomingCount += 1;
        for (const t of s.tickets) {
          soldTotal += 1;
          revenueTotal += t.price;
        }
      }
      return {
        id: m.id,
        title: m.title,
        image: m.image,
        isActive: m.isActive,
        screeningsCount: m.screenings.length,
        upcomingCount,
        soldTotal,
        revenueTotal,
      };
    });

    return { success: true, error: null, movies: list };
  } catch (error) {
    console.error('[getMyProducedMovies] Error:', error);
    return {
      success: false,
      error: 'Ֆիլմերը բեռնելիս սխալ է տեղի ունեցել',
      movies: [],
    };
  }
}

/** Կոնկրետ ֆիլմի մանրամասն հաշվետվություն՝ ըստ ցուցադրության */
export async function getProducerMovieReport(params: {
  movieId: number;
  from?: string;
  to?: string;
}): Promise<{
  success: boolean;
  error: string | null;
  data: ProducerMovieReport | null;
}> {
  const user = await getSessionUser();
  if (!user || (!isProducerRole(user.role) && !isAdminRole(user.role))) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  try {
    // Ստուգել՝ ֆիլմը կցված է այս արտադրողին (admin-ին թույլ ենք տալիս ամեն ինչ)
    const movie = await prisma.movie.findFirst({
      where: {
        id: params.movieId,
        ...(isAdminRole(user.role)
          ? {}
          : { producers: { some: { id: user.id } } }),
      },
      select: { id: true, title: true, image: true },
    });

    if (!movie) {
      return {
        success: false,
        error: 'Ֆիլմը չի գտնվել կամ ձեզ կցված չէ',
        data: null,
      };
    }

    let from: Date | null = null;
    let to: Date | null = null;
    if (params.from) {
      const d = new Date(params.from);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        from = d;
      }
    }
    if (params.to) {
      const d = new Date(params.to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        to = d;
      }
    }

    const screenings = await prisma.screening.findMany({
      where: {
        movieId: movie.id,
        ...(from || to
          ? { startTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        hall: {
          select: {
            name: true,
            capacity: true,
            seats: {
              orderBy: [{ row: 'asc' }, { number: 'asc' }],
              select: {
                id: true,
                row: true,
                number: true,
                seatType: true,
              },
            },
          },
        },
        tickets: {
          select: {
            seatId: true,
            status: true,
            price: true,
            createdAt: true,
            updatedAt: true,
            holdUntil: true,
          },
        },
      },
    });

    const STATUS_PRIORITY = [
      'used',
      'paid',
      'reserved',
      'awaiting_payment',
      'cancelled',
    ] as const;

    const rows: ProducerScreeningRow[] = screenings.map((s) => {
      let sold = 0;
      let attended = 0;
      let noShow = 0;
      let reserved = 0;
      let cancelled = 0;
      let revenue = 0;

      const ticketBySeat = new Map<number, (typeof s.tickets)[number]>();
      for (const t of s.tickets) {
        const existing = ticketBySeat.get(t.seatId);
        if (!existing) {
          ticketBySeat.set(t.seatId, t);
          continue;
        }
        const existingIdx = STATUS_PRIORITY.indexOf(
          existing.status as (typeof STATUS_PRIORITY)[number]
        );
        const nextIdx = STATUS_PRIORITY.indexOf(
          t.status as (typeof STATUS_PRIORITY)[number]
        );
        if (nextIdx >= 0 && (existingIdx < 0 || nextIdx < existingIdx)) {
          ticketBySeat.set(t.seatId, t);
        }
      }

      const screeningEnded = new Date(s.endTime) < new Date();
      for (const t of s.tickets) {
        const isSold = t.status === 'paid' || t.status === 'used';
        if (isSold) revenue += t.price;
        if (t.status === 'paid' || t.status === 'used') sold += 1;
        if (t.status === 'used') attended += 1;
        if (t.status === 'paid' && screeningEnded) noShow += 1;
        if (t.status === 'reserved') reserved += 1;
        if (t.status === 'cancelled') cancelled += 1;
      }

      const hallSeats: ProducerHallSeat[] = (s.hall?.seats ?? []).map(
        (seat) => {
          const ticket = ticketBySeat.get(seat.id);
          const isExpiredHold =
            ticket?.status === 'awaiting_payment' &&
            !isActivePaymentHold(ticket.holdUntil);
          if (!ticket || ticket.status === 'cancelled' || isExpiredHold) {
            return {
              id: seat.id,
              row: seat.row,
              number: seat.number,
              seatType: seat.seatType,
              ticket: null,
            };
          }
          return {
            id: seat.id,
            row: seat.row,
            number: seat.number,
            seatType: seat.seatType,
            ticket: {
              status: ticket.status as ProducerSeatTicket['status'],
              price: ticket.price,
              createdAt: ticket.createdAt.toISOString(),
              updatedAt: ticket.updatedAt.toISOString(),
              holdUntil: ticket.holdUntil
                ? ticket.holdUntil.toISOString()
                : null,
            },
          };
        }
      );

      const capacity = s.hall?.capacity ?? 0;
      return {
        screeningId: s.id,
        startTime: new Date(s.startTime).toISOString(),
        endTime: new Date(s.endTime).toISOString(),
        hallName: s.hall?.name ?? '—',
        capacity,
        sold,
        attended,
        noShow,
        reserved,
        cancelled,
        revenue,
        occupancy: capacity > 0 ? sold / capacity : 0,
        hallSeats,
      };
    });

    const totals = rows.reduce<ProducerReportTotals>(
      (acc, r) => {
        acc.screenings += 1;
        acc.capacity += r.capacity;
        acc.sold += r.sold;
        acc.attended += r.attended;
        acc.noShow += r.noShow;
        acc.reserved += r.reserved;
        acc.cancelled += r.cancelled;
        acc.revenue += r.revenue;
        return acc;
      },
      {
        screenings: 0,
        capacity: 0,
        sold: 0,
        attended: 0,
        noShow: 0,
        reserved: 0,
        cancelled: 0,
        revenue: 0,
        occupancy: 0,
      }
    );
    totals.occupancy = totals.capacity > 0 ? totals.sold / totals.capacity : 0;

    return {
      success: true,
      error: null,
      data: {
        movie,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        totals,
        screenings: rows,
      },
    };
  } catch (error) {
    console.error('[getProducerMovieReport] Error:', error);
    return {
      success: false,
      error: 'Հաշվետվությունը բեռնելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}
