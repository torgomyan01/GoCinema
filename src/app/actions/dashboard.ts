'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isStaffRole } from '@/lib/roles';
import { WALK_IN_PHONE } from '@/lib/bonus';

const BIRTHDAY_WINDOW_DAYS = 15;

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isStaffRole(user.role)) return null;
  return user;
}

/** Հաջորդ ծնունդը և օրերի քանակը (տարեվերջ/տարեսկիզբ ներառյալ) */
function getNextBirthdayMeta(
  birthDate: Date,
  now: Date = new Date()
): { daysUntil: number; birthdayYear: number; nextBirthday: Date } {
  const month = birthDate.getUTCMonth();
  const day = birthDate.getUTCDate();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let year = today.getFullYear();
  let next = new Date(year, month, day);
  if (next < today) {
    year += 1;
    next = new Date(year, month, day);
  }

  const daysUntil = Math.round(
    (next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
  return { daysUntil, birthdayYear: year, nextBirthday: next };
}

export type UpcomingBirthdayUser = {
  id: number;
  name: string | null;
  phone: string;
  birthDate: string;
  nextBirthday: string;
  daysUntil: number;
  birthdayYear: number;
  called: boolean;
};

export async function getUpcomingBirthdays(withinDays = BIRTHDAY_WINDOW_DAYS) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false as const, error: 'Մուտքն արգելված է', users: [] as UpcomingBirthdayUser[] };
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        birthDate: { not: null },
        phone: { not: WALK_IN_PHONE },
        isBlocked: false,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        birthDate: true,
        birthdayPromoCalledYear: true,
      },
    });

    const now = new Date();
    const upcoming: UpcomingBirthdayUser[] = [];

    for (const user of users) {
      if (!user.birthDate) continue;
      const meta = getNextBirthdayMeta(new Date(user.birthDate), now);
      if (meta.daysUntil < 0 || meta.daysUntil > withinDays) continue;
      upcoming.push({
        id: user.id,
        name: user.name,
        phone: user.phone,
        birthDate: user.birthDate.toISOString().slice(0, 10),
        nextBirthday: meta.nextBirthday.toISOString().slice(0, 10),
        daysUntil: meta.daysUntil,
        birthdayYear: meta.birthdayYear,
        called: user.birthdayPromoCalledYear === meta.birthdayYear,
      });
    }

    upcoming.sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
      if (a.called !== b.called) return a.called ? 1 : -1;
      return (a.name || a.phone).localeCompare(b.name || b.phone, 'hy');
    });

    return { success: true as const, error: null, users: upcoming };
  } catch (error) {
    console.error('[getUpcomingBirthdays]', error);
    return {
      success: false as const,
      error: 'Ծննդյան ցանկը բեռնելիս սխալ է տեղի ունեցել',
      users: [] as UpcomingBirthdayUser[],
    };
  }
}

/** Նշել / հանել ծննդյան ակցիայի զանգի կարգավիճակը */
export async function setBirthdayPromoCalled(
  userId: number,
  called: boolean
): Promise<{ success: boolean; error?: string; called?: boolean }> {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const id = Math.trunc(Number(userId));
  if (!Number.isFinite(id) || id <= 0) {
    return { success: false, error: 'Անվավեր օգտատեր' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, birthDate: true },
    });
    if (!user?.birthDate) {
      return { success: false, error: 'Օգտատերը կամ ծննդյան ամսաթիվը չի գտնվել' };
    }

    const { birthdayYear } = getNextBirthdayMeta(new Date(user.birthDate));
    await prisma.user.update({
      where: { id },
      data: {
        birthdayPromoCalledYear: called ? birthdayYear : null,
      },
    });

    revalidatePath('/admin');
    return { success: true, called };
  } catch (error) {
    console.error('[setBirthdayPromoCalled]', error);
    return { success: false, error: 'Չհաջողվեց պահպանել' };
  }
}

export async function getDashboardStats() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get current month stats
    const [
      totalUsers,
      totalMovies,
      ticketsThisMonth,
      totalRevenue,
      ticketsLastMonth,
      revenueLastMonth,
      usersLastMonth,
    ] = await Promise.all([
      // Total Users
      prisma.user.count(),

      // Total Active Movies
      prisma.movie.count({
        where: { isActive: true },
      }),

      // Tickets this month
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),

      // Total Revenue (sold tickets: paid + used)
      prisma.ticket.aggregate({
        where: {
          status: { in: ['paid', 'used'] },
        },
        _sum: {
          price: true,
        },
      }),

      // Tickets last month (for comparison)
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),

      // Revenue last month
      prisma.ticket.aggregate({
        where: {
          status: { in: ['paid', 'used'] },
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
        _sum: {
          price: true,
        },
      }),

      // Users last month
      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
    ]);

    // Calculate changes
    const ticketChange =
      ticketsLastMonth > 0
        ? Math.round(
            ((ticketsThisMonth - ticketsLastMonth) / ticketsLastMonth) * 100
          )
        : ticketsThisMonth > 0
          ? 100
          : 0;

    const revenueChange =
      (revenueLastMonth._sum.price || 0) > 0
        ? Math.round(
            (((totalRevenue._sum.price || 0) -
              (revenueLastMonth._sum.price || 0)) /
              (revenueLastMonth._sum.price || 0)) *
              100
          )
        : (totalRevenue._sum.price || 0) > 0
          ? 100
          : 0;

    const userChange =
      usersLastMonth > 0
        ? Math.round(((totalUsers - usersLastMonth) / usersLastMonth) * 100)
        : totalUsers > 0
          ? 100
          : 0;

    return {
      success: true,
      stats: {
        totalUsers,
        totalMovies,
        ticketsThisMonth,
        totalRevenue: totalRevenue._sum.price || 0,
        changes: {
          tickets: ticketChange,
          revenue: revenueChange,
          users: userChange,
        },
      },
    };
  } catch (error: any) {
    console.error('[Get Dashboard Stats] Error:', error);
    return {
      success: false,
      error: 'Վիճակագրությունը բեռնելիս սխալ է տեղի ունեցել',
      stats: null,
    };
  }
}

export async function getRecentActivity() {
  try {
    const activities: Array<{
      type: string;
      action: string;
      user: string;
      time: Date;
    }> = [];

    // Get recent sold tickets (paid + used)
    const recentTickets = await prisma.ticket.findMany({
      where: {
        status: { in: ['paid', 'used'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    recentTickets.forEach((ticket) => {
      activities.push({
        type: 'ticket',
        action: 'Տոմս վաճառվեց',
        user: ticket.user.name || `Օգտատեր #${ticket.user.id}`,
        time: new Date(ticket.createdAt),
      });
    });

    // Get recent movies
    const recentMovies = await prisma.movie.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    recentMovies.forEach((movie) => {
      activities.push({
        type: 'movie',
        action: `Ֆիլմ ավելացվեց: ${movie.title}`,
        user: 'Ադմին',
        time: new Date(movie.createdAt),
      });
    });

    // Get recent screenings
    const recentScreenings = await prisma.screening.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        movie: {
          select: {
            title: true,
          },
        },
      },
    });

    recentScreenings.forEach((screening) => {
      activities.push({
        type: 'screening',
        action: `Ցուցադրություն ստեղծվեց: ${screening.movie?.title || 'Անհայտ'}`,
        user: 'Ադմին',
        time: new Date(screening.createdAt),
      });
    });

    // Get recent users
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    recentUsers.forEach((user) => {
      activities.push({
        type: 'user',
        action: 'Նոր օգտատեր գրանցվեց',
        user: user.name || `Օգտատեր #${user.id}`,
        time: new Date(user.createdAt),
      });
    });

    // Sort by time and take most recent 10
    activities.sort((a, b) => b.time.getTime() - a.time.getTime());

    return {
      success: true,
      activities: activities.slice(0, 10),
    };
  } catch (error: any) {
    console.error('[Get Recent Activity] Error:', error);
    return {
      success: false,
      error: 'Գործողությունները բեռնելիս սխալ է տեղի ունեցել',
      activities: [],
    };
  }
}
