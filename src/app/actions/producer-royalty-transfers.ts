'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { isAdminRole } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import {
  formatMonthKey,
  formatMonthYearHy,
  getYerevanCalendarMonth,
  getYerevanPreviousCalendarMonth,
  listYerevanMonthKeys,
} from '@/lib/format';

async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isAdminRole(user.role)) return null;
  return user;
}

function dateOnlyUtcNoon(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

export type MovieRoyaltyTransferRow = {
  /** YYYY-MM */
  monthKey: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  screeningsCount: number;
  ticketsSold: number;
  revenue: number;
  royaltyPercent: number;
  royaltyAmount: number;
  transferred: boolean;
  transferredAt: string | null;
  transferredByName: string | null;
};

export async function getMovieMonthlyRoyaltyTransfers(movieId: number): Promise<{
  success: boolean;
  error?: string;
  movieTitle?: string;
  rows?: MovieRoyaltyTransferRow[];
  unpaidCount?: number;
  paidCount?: number;
}> {
  const admin = await requireAdminSession();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  if (!Number.isFinite(movieId) || movieId <= 0) {
    return { success: false, error: 'Ֆիլմը չի գտնվել' };
  }

  try {
    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      select: {
        id: true,
        title: true,
        releaseDate: true,
        licenseContract: {
          select: {
            royaltyPercent: true,
            premiereDate: true,
          },
        },
      },
    });

    if (!movie) {
      return { success: false, error: 'Ֆիլմը չի գտնվել' };
    }

    const royaltyPercent = movie.licenseContract?.royaltyPercent ?? 50;
    const previousMonth = getYerevanPreviousCalendarMonth();
    const endMonthKey = formatMonthKey(previousMonth.start);

    const earliestScreening = await prisma.screening.findFirst({
      where: { movieId },
      orderBy: { startTime: 'asc' },
      select: { startTime: true },
    });

    const startCandidates = [
      earliestScreening?.startTime,
      movie.licenseContract?.premiereDate,
      movie.releaseDate,
    ].filter((d): d is Date => Boolean(d));

    if (startCandidates.length === 0 || !endMonthKey) {
      return {
        success: true,
        movieTitle: movie.title,
        rows: [],
        unpaidCount: 0,
        paidCount: 0,
      };
    }

    const startMonthKey = startCandidates
      .map((d) => formatMonthKey(d))
      .filter(Boolean)
      .sort()[0];

    if (!startMonthKey || startMonthKey > endMonthKey) {
      return {
        success: true,
        movieTitle: movie.title,
        rows: [],
        unpaidCount: 0,
        paidCount: 0,
      };
    }

    const monthKeys = listYerevanMonthKeys(startMonthKey, endMonthKey);
    const overallStart = getYerevanCalendarMonth(
      Number(startMonthKey.slice(0, 4)),
      Number(startMonthKey.slice(5, 7))
    ).start;

    const [screenings, transfers] = await Promise.all([
      prisma.screening.findMany({
        where: {
          movieId,
          startTime: { gte: overallStart, lte: previousMonth.end },
        },
        select: {
          startTime: true,
          tickets: {
            where: { status: { in: ['paid', 'used'] } },
            select: { price: true },
          },
        },
      }),
      prisma.producerRoyaltyTransfer.findMany({
        where: { movieId },
        select: {
          periodStart: true,
          transferredAt: true,
          transferredBy: { select: { name: true } },
        },
      }),
    ]);

    const transferByMonth = new Map(
      transfers.map((t) => [formatMonthKey(t.periodStart), t])
    );

    type MonthAcc = {
      screeningsCount: number;
      ticketsSold: number;
      revenue: number;
    };
    const statsByMonth = new Map<string, MonthAcc>();
    for (const key of monthKeys) {
      statsByMonth.set(key, {
        screeningsCount: 0,
        ticketsSold: 0,
        revenue: 0,
      });
    }

    for (const screening of screenings) {
      const key = formatMonthKey(screening.startTime);
      const acc = statsByMonth.get(key);
      if (!acc) continue;
      const revenue = Math.round(
        screening.tickets.reduce((sum, t) => sum + t.price, 0)
      );
      acc.screeningsCount += 1;
      acc.ticketsSold += screening.tickets.length;
      acc.revenue += revenue;
    }

    const rows: MovieRoyaltyTransferRow[] = monthKeys
      .map((monthKey) => {
        const [year, month] = monthKey.split('-').map(Number);
        const range = getYerevanCalendarMonth(year, month);
        const stats = statsByMonth.get(monthKey) || {
          screeningsCount: 0,
          ticketsSold: 0,
          revenue: 0,
        };
        const transfer = transferByMonth.get(monthKey);
        const transferred = Boolean(transfer?.transferredAt);
        // Ցույց տալ ամիսը, եթե կա ցուցադրություն կամ արդեն նշված փոխանցում
        if (stats.screeningsCount === 0 && !transferred) {
          return null;
        }
        return {
          monthKey,
          periodLabel: formatMonthYearHy(range.start),
          periodStart: range.startKey,
          periodEnd: range.endKey,
          screeningsCount: stats.screeningsCount,
          ticketsSold: stats.ticketsSold,
          revenue: stats.revenue,
          royaltyPercent,
          royaltyAmount: Math.round((stats.revenue * royaltyPercent) / 100),
          transferred,
          transferredAt: transfer?.transferredAt?.toISOString() ?? null,
          transferredByName: transfer?.transferredBy?.name ?? null,
        } satisfies MovieRoyaltyTransferRow;
      })
      .filter((row): row is MovieRoyaltyTransferRow => Boolean(row));

    rows.sort((a, b) => {
      if (a.transferred !== b.transferred) {
        return a.transferred ? 1 : -1;
      }
      return b.monthKey.localeCompare(a.monthKey);
    });

    return {
      success: true,
      movieTitle: movie.title,
      rows,
      unpaidCount: rows.filter((r) => !r.transferred).length,
      paidCount: rows.filter((r) => r.transferred).length,
    };
  } catch (error) {
    console.error('[getMovieMonthlyRoyaltyTransfers]', error);
    return {
      success: false,
      error: 'Փոխանցումների ցանկը բեռնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function setMovieMonthRoyaltyTransferred(
  movieId: number,
  monthKey: string,
  transferred: boolean
): Promise<{
  success: boolean;
  error?: string;
  transferredAt?: string | null;
  transferredByName?: string | null;
}> {
  const admin = await requireAdminSession();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  if (!Number.isFinite(movieId) || movieId <= 0) {
    return { success: false, error: 'Ֆիլմը չի գտնվել' };
  }

  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return { success: false, error: 'Ամիսը սխալ է' };
  }

  const [year, month] = monthKey.split('-').map(Number);
  const range = getYerevanCalendarMonth(year, month);
  const periodStart = dateOnlyUtcNoon(range.startKey);

  try {
    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      select: { id: true },
    });
    if (!movie) {
      return { success: false, error: 'Ֆիլմը չի գտնվել' };
    }

    const adminId = Number(admin.id);
    const nextById =
      Number.isFinite(adminId) && adminId > 0 ? adminId : null;

    const existing = await prisma.producerRoyaltyTransfer.findUnique({
      where: {
        movieId_periodStart: { movieId, periodStart },
      },
      select: { transferredAt: true, transferredById: true },
    });

    if (!transferred) {
      if (existing) {
        await prisma.producerRoyaltyTransfer.update({
          where: {
            movieId_periodStart: { movieId, periodStart },
          },
          data: {
            transferredAt: null,
            transferredById: null,
          },
        });
      }
      revalidatePath('/admin/movies');
      return {
        success: true,
        transferredAt: null,
        transferredByName: null,
      };
    }

    const transferredAt = existing?.transferredAt ?? new Date();
    const transferredById = existing?.transferredAt
      ? existing.transferredById
      : nextById;

    const updated = await prisma.producerRoyaltyTransfer.upsert({
      where: {
        movieId_periodStart: { movieId, periodStart },
      },
      create: {
        movieId,
        periodStart,
        transferredAt,
        transferredById,
      },
      update: {
        transferredAt,
        ...(existing?.transferredAt ? {} : { transferredById }),
      },
      select: {
        transferredAt: true,
        transferredBy: { select: { name: true } },
      },
    });

    revalidatePath('/admin/movies');

    return {
      success: true,
      transferredAt: updated.transferredAt?.toISOString() ?? null,
      transferredByName: updated.transferredBy?.name ?? null,
    };
  } catch (error) {
    console.error('[setMovieMonthRoyaltyTransferred]', error);
    return {
      success: false,
      error: 'Փոխանցման կարգավիճակը պահելիս սխալ է տեղի ունեցել',
    };
  }
}
