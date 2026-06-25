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
          hall: { select: { capacity: true } },
          movie: { select: { id: true, title: true, image: true } },
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
        };
        movieMap.set(id, row);
      }
      return row;
    };

    // Ցուցադրությունների քանակ + ընդհանուր տեղեր (ըստ startTime ժամանակահատվածի)
    for (const s of screenings) {
      const row = ensureRow(s.movieId, s.movie.title, s.movie.image);
      row.screenings += 1;
      row.capacity += s.hall?.capacity ?? 0;
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
      if (t.status === 'paid') row.noShow += 1;
      if (t.status === 'reserved') row.reserved += 1;
      if (t.status === 'cancelled') row.cancelled += 1;
    }

    for (const row of movieMap.values()) {
      row.occupancy = row.capacity > 0 ? row.sold / row.capacity : 0;
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
