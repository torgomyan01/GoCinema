'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdminRole } from '@/lib/roles';

export type ReportBasis = 'sale' | 'screening';

export interface MovieReportRow {
  movieId: number;
  title: string;
  image: string | null;
  sold: number; // paid + used
  attended: number; // used (սկանավորված մուտք)
  noShow: number; // paid (վաճառված, բայց չսկանավորված)
  reserved: number; // reserved (չվճարված)
  cancelled: number; // cancelled
  revenue: number; // sum(price) where paid + used
  screenings: number; // ցուցադրությունների քանակ (ըստ startTime)
  capacity: number; // ընդհանուր տեղեր այդ ցուցադրություններում
  occupancy: number; // 0..1 (sold / capacity)
  screeningDetails: MovieReportScreening[];
}

export interface MovieReportOrderItem {
  id: number;
  ticketId: number | null;
  quantity: number;
  price: number;
  product: {
    id: number;
    name: string;
    category: string;
  };
}

export interface MovieReportTicket {
  id: number;
  status: string;
  price: number;
  noShow: boolean;
  createdAt: string;
  usedAtLabel: string | null;
  seat: {
    id: number;
    row: string;
    number: number;
    seatType: string;
  } | null;
  user: {
    id: number;
    name: string | null;
    phone: string | null;
    email: string | null;
  };
  order: {
    id: number;
    status: string;
    paymentMethod: string;
    totalAmount: number;
  } | null;
  orderItems: MovieReportOrderItem[];
}

export interface MovieReportScreening {
  id: number;
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
  tickets: MovieReportTicket[];
}

export interface WeeklyPoint {
  weekStart: string; // YYYY-MM-DD (երկուշաբթի)
  sold: number;
  attended: number;
  cancelled: number;
  revenue: number;
}

export interface ReportTotals {
  sold: number;
  attended: number;
  noShow: number;
  reserved: number;
  cancelled: number;
  revenue: number;
  screenings: number;
  capacity: number;
  occupancy: number;
}

export interface MovieReportData {
  rows: MovieReportRow[];
  totals: ReportTotals;
  weekly: WeeklyPoint[];
  basis: ReportBasis;
  from: string;
  to: string;
}

/** Շաբաթվա սկիզբը (երկուշաբթի, տեղական ժամանակով) */
function getWeekStart(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const dayFromMonday = (date.getDay() + 6) % 7; // Mon = 0 ... Sun = 6
  date.setDate(date.getDate() - dayFromMonday);
  return date;
}

function localDateKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getMovieReports(params: {
  from: string;
  to: string;
  basis: ReportBasis;
}): Promise<{
  success: boolean;
  error: string | null;
  data: MovieReportData | null;
}> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user || !isAdminRole(user.role)) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  try {
    const from = new Date(params.from);
    const to = new Date(params.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { success: false, error: 'Սխալ ամսաթիվ', data: null };
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    const now = new Date();

    const basis: ReportBasis = params.basis === 'sale' ? 'sale' : 'screening';

    const ticketWhere =
      basis === 'sale'
        ? { createdAt: { gte: from, lte: to } }
        : { screening: { startTime: { gte: from, lte: to } } };

    const [tickets, screenings] = await Promise.all([
      prisma.ticket.findMany({
        where: ticketWhere,
        select: {
          status: true,
          price: true,
          createdAt: true,
          screening: {
            select: {
              movieId: true,
              startTime: true,
              endTime: true,
              movie: { select: { id: true, title: true, image: true } },
            },
          },
        },
      }),
      prisma.screening.findMany({
        where: { startTime: { gte: from, lte: to } },
        select: {
          id: true,
          movieId: true,
          startTime: true,
          endTime: true,
          hall: { select: { name: true, capacity: true } },
          movie: { select: { id: true, title: true, image: true } },
          tickets: {
            orderBy: [{ seat: { row: 'asc' } }, { seat: { number: 'asc' } }],
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  email: true,
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
                  product: {
                    select: {
                      id: true,
                      name: true,
                      category: true,
                    },
                  },
                },
              },
              order: {
                include: {
                  orderItems: {
                    include: {
                      product: {
                        select: {
                          id: true,
                          name: true,
                          category: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const movieMap = new Map<number, MovieReportRow>();
    const ensureRow = (
      id: number,
      title: string,
      image: string | null
    ): MovieReportRow => {
      let row = movieMap.get(id);
      if (!row) {
        row = {
          movieId: id,
          title,
          image,
          sold: 0,
          attended: 0,
          noShow: 0,
          reserved: 0,
          cancelled: 0,
          revenue: 0,
          screenings: 0,
          capacity: 0,
          occupancy: 0,
          screeningDetails: [],
        };
        movieMap.set(id, row);
      }
      return row;
    };

    // Ցուցադրությունների քանակ + ընդհանուր տեղեր + մանրամասներ (ըստ startTime ժամանակահատվածի)
    for (const s of screenings) {
      const row = ensureRow(s.movieId, s.movie.title, s.movie.image);
      row.screenings += 1;
      row.capacity += s.hall?.capacity ?? 0;
      row.screeningDetails.push({
        id: s.id,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        hallName: s.hall?.name ?? '—',
        capacity: s.hall?.capacity ?? 0,
        sold: 0,
        attended: 0,
        noShow: 0,
        reserved: 0,
        cancelled: 0,
        revenue: 0,
        tickets: s.tickets
          .map((ticket) => {
            const itemsFromOrder =
              ticket.order?.orderItems.filter(
                (item) => item.ticketId === ticket.id || item.ticketId === null
              ) ?? [];
            const itemById = new Map<number, (typeof itemsFromOrder)[number]>();
            for (const item of [...ticket.orderItems, ...itemsFromOrder]) {
              itemById.set(item.id, item);
            }
            return {
              id: ticket.id,
              status: ticket.status,
              price: ticket.price,
              noShow: ticket.noShow,
              createdAt: ticket.createdAt.toISOString(),
              usedAtLabel: ticket.status === 'used' ? 'Սկանավորված' : null,
              seat: ticket.seat
                ? {
                    id: ticket.seat.id,
                    row: ticket.seat.row,
                    number: ticket.seat.number,
                    seatType: ticket.seat.seatType,
                  }
                : null,
              user: ticket.user,
              order: ticket.order
                ? {
                    id: ticket.order.id,
                    status: ticket.order.status,
                    paymentMethod: ticket.order.paymentMethod,
                    totalAmount: ticket.order.totalAmount,
                  }
                : null,
              orderItems: Array.from(itemById.values()).map((item) => ({
                id: item.id,
                ticketId: item.ticketId,
                quantity: item.quantity,
                price: item.price,
                product: item.product,
              })),
            };
          })
          .sort((a, b) => {
            const rowCompare = (a.seat?.row ?? '').localeCompare(
              b.seat?.row ?? ''
            );
            if (rowCompare !== 0) return rowCompare;
            return (a.seat?.number ?? 0) - (b.seat?.number ?? 0);
          }),
      });
    }

    // Տոմսերի ագրեգացիա
    for (const t of tickets) {
      const movie = t.screening.movie;
      const row = ensureRow(movie.id, movie.title, movie.image);
      const isSold = t.status === 'paid' || t.status === 'used';
      if (isSold) {
        row.sold += 1;
        row.revenue += t.price;
      }
      if (t.status === 'used') row.attended += 1;
      if (t.status === 'paid' && new Date(t.screening.endTime) < now) {
        row.noShow += 1;
      }
      if (t.status === 'reserved') row.reserved += 1;
      if (t.status === 'cancelled') row.cancelled += 1;
    }

    for (const row of movieMap.values()) {
      row.occupancy = row.capacity > 0 ? row.sold / row.capacity : 0;
      for (const screening of row.screeningDetails) {
        for (const ticket of screening.tickets) {
          const isSold = ticket.status === 'paid' || ticket.status === 'used';
          if (isSold) {
            screening.sold += 1;
            screening.revenue += ticket.price;
          }
          if (ticket.status === 'used') screening.attended += 1;
          if (ticket.status === 'paid' && new Date(screening.endTime) < now) {
            screening.noShow += 1;
          }
          if (ticket.status === 'reserved') screening.reserved += 1;
          if (ticket.status === 'cancelled') screening.cancelled += 1;
        }
      }
    }

    const rows = Array.from(movieMap.values()).sort((a, b) => b.sold - a.sold);

    const totals = rows.reduce<ReportTotals>(
      (acc, r) => {
        acc.sold += r.sold;
        acc.attended += r.attended;
        acc.noShow += r.noShow;
        acc.reserved += r.reserved;
        acc.cancelled += r.cancelled;
        acc.revenue += r.revenue;
        acc.screenings += r.screenings;
        acc.capacity += r.capacity;
        return acc;
      },
      {
        sold: 0,
        attended: 0,
        noShow: 0,
        reserved: 0,
        cancelled: 0,
        revenue: 0,
        screenings: 0,
        capacity: 0,
        occupancy: 0,
      }
    );
    totals.occupancy = totals.capacity > 0 ? totals.sold / totals.capacity : 0;

    // Շաբաթական դինամիկա
    const weekMap = new Map<string, WeeklyPoint>();
    for (const t of tickets) {
      const basisDate =
        basis === 'sale'
          ? new Date(t.createdAt)
          : new Date(t.screening.startTime);
      const key = localDateKey(getWeekStart(basisDate));
      let point = weekMap.get(key);
      if (!point) {
        point = {
          weekStart: key,
          sold: 0,
          attended: 0,
          cancelled: 0,
          revenue: 0,
        };
        weekMap.set(key, point);
      }
      const isSold = t.status === 'paid' || t.status === 'used';
      if (isSold) {
        point.sold += 1;
        point.revenue += t.price;
      }
      if (t.status === 'used') point.attended += 1;
      if (t.status === 'cancelled') point.cancelled += 1;
    }

    const weekly = Array.from(weekMap.values()).sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart)
    );

    return {
      success: true,
      error: null,
      data: {
        rows,
        totals,
        weekly,
        basis,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    };
  } catch (error) {
    console.error('[getMovieReports] Error:', error);
    return {
      success: false,
      error: 'Հաշվետվությունը բեռնելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}
