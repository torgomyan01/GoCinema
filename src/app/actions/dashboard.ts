'use server';

import { prisma } from '@/lib/prisma';

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

      // Total Revenue (from paid tickets)
      prisma.ticket.aggregate({
        where: {
          status: 'paid',
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
          status: 'paid',
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

    // Get recent tickets (paid)
    const recentTickets = await prisma.ticket.findMany({
      where: {
        status: 'paid',
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
