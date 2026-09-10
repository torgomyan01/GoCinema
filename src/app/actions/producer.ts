'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdminRole, isProducerRole } from '@/lib/roles';
import { isActivePaymentHold, isPaidTicketStatus } from '@/lib/reservation';
import { getYerevanDayRange } from '@/lib/format';

const SOLD_STATUSES = ['paid', 'used'] as const;

/** Նույն նստատեղի մի քանի տոմսից ընտրել «ընթացիկ»-ը (օգտագործված > վճարված > ամրագրված > …) */
const STATUS_PRIORITY = [
  'used',
  'paid',
  'reserved',
  'awaiting_payment',
  'cancelled',
] as const;

type TicketStatusPriority = (typeof STATUS_PRIORITY)[number];

function pickCurrentTicketBySeat<
  T extends {
    seatId: number;
    status: string;
    updatedAt?: Date | string;
    createdAt?: Date | string;
    id?: number;
  },
>(tickets: T[]): Map<number, T> {
  const ticketBySeat = new Map<number, T>();

  const tieBreak = (a: T, b: T) => {
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    if (bTime !== aTime) return bTime - aTime;
    return (b.id ?? 0) - (a.id ?? 0);
  };

  for (const t of tickets) {
    const existing = ticketBySeat.get(t.seatId);
    if (!existing) {
      ticketBySeat.set(t.seatId, t);
      continue;
    }
    const existingIdx = STATUS_PRIORITY.indexOf(
      existing.status as TicketStatusPriority
    );
    const nextIdx = STATUS_PRIORITY.indexOf(t.status as TicketStatusPriority);
    if (nextIdx >= 0 && (existingIdx < 0 || nextIdx < existingIdx)) {
      ticketBySeat.set(t.seatId, t);
      continue;
    }
    // Նույն ստատուս՝ վերցնել ավելի ուշ թարմացվածը (կրկնակի used/paid տողերի դեպքում)
    if (nextIdx === existingIdx && tieBreak(existing, t) > 0) {
      ticketBySeat.set(t.seatId, t);
    }
  }
  return ticketBySeat;
}

/** YYYY-MM-DD → Երևանի օրվա սկիզբ / վերջ */
function parseYerevanDateBound(
  key: string | undefined,
  edge: 'start' | 'end'
): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  if (edge === 'start') {
    const d = new Date(`${key}T00:00:00+04:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const range = getYerevanDayRange(key, key);
  return range?.end ?? null;
}

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
              select: {
                id: true,
                seatId: true,
                price: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
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
        // Մեկ նստատեղ = մեկ վաճառք (կրկնակի պատմական տողերը չեն գումարվում)
        const bySeat = pickCurrentTicketBySeat(s.tickets);
        for (const t of bySeat.values()) {
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

    const fromKey = params.from?.trim() || '';
    const toKey = params.to?.trim() || '';
    let from: Date | null = null;
    let to: Date | null = null;

    if (fromKey && toKey) {
      const range = getYerevanDayRange(fromKey, toKey);
      if (range) {
        from = range.start;
        to = range.end;
      }
    } else {
      from = parseYerevanDateBound(fromKey || undefined, 'start');
      to = parseYerevanDateBound(toKey || undefined, 'end');
    }

    const screenings = await prisma.screening.findMany({
      where: {
        movieId: movie.id,
        ...(from || to
          ? {
              startTime: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
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
            id: true,
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

    const now = new Date();

    const rows: ProducerScreeningRow[] = screenings.map((s) => {
      const seats = s.hall?.seats ?? [];
      const ticketBySeat = pickCurrentTicketBySeat(s.tickets);
      const screeningEnded = new Date(s.endTime) < now;

      let sold = 0;
      let attended = 0;
      let noShow = 0;
      let reserved = 0;
      let cancelled = 0;
      let revenue = 0;

      // Մետրիկաները՝ միայն նստատեղի ընթացիկ տոմսով (համընկնում է սխեմայի հետ)
      for (const seat of seats) {
        const ticket = ticketBySeat.get(seat.id);
        if (!ticket) continue;

        const isExpiredHold =
          ticket.status === 'awaiting_payment' &&
          !isActivePaymentHold(ticket.holdUntil, now);

        if (ticket.status === 'cancelled' || isExpiredHold) {
          continue;
        }

        if (isPaidTicketStatus(ticket.status)) {
          sold += 1;
          revenue += ticket.price;
          if (ticket.status === 'used') attended += 1;
          else if (ticket.status === 'paid' && screeningEnded) noShow += 1;
          continue;
        }

        if (
          ticket.status === 'reserved' ||
          ticket.status === 'awaiting_payment'
        ) {
          reserved += 1;
        }
      }

      // Չեղարկումներ՝ եզակի նստատեղեր, որոնք ունեն cancelled տող
      // (ոչ բոլոր պատմական տողերը՝ կրկնակի չեղարկումը չի գումարվում)
      cancelled = new Set(
        s.tickets
          .filter((t) => t.status === 'cancelled')
          .map((t) => t.seatId)
      ).size;

      const hallSeats: ProducerHallSeat[] = seats.map((seat) => {
        const ticket = ticketBySeat.get(seat.id);
        const isExpiredHold =
          ticket?.status === 'awaiting_payment' &&
          !isActivePaymentHold(ticket.holdUntil, now);
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
      });

      // Զբաղվածություն՝ ըստ իրական նստատեղերի քանակի (ոչ հնացած hall.capacity)
      const capacity =
        seats.length > 0 ? seats.length : (s.hall?.capacity ?? 0);

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
        occupancy: capacity > 0 ? Math.min(1, sold / capacity) : 0,
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
    totals.occupancy =
      totals.capacity > 0
        ? Math.min(1, totals.sold / totals.capacity)
        : 0;

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
