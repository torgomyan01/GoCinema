'use server';

import { prisma } from '@/lib/prisma';

export async function getAnalytics() {
  try {
    // Get all statistics in parallel
    const [
      totalUsers,
      totalMovies,
      totalScreenings,
      totalTickets,
      totalOrders,
      totalRevenue,
      activeMovies,
      upcomingScreenings,
      recentOrders,
      topMovies,
      userStats,
    ] = await Promise.all([
      // Total Users
      prisma.user.count(),

      // Total Movies
      prisma.movie.count({
        where: { isActive: true },
      }),

      // Total Screenings
      prisma.screening.count({
        where: {
          startTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),

      // Total Tickets
      prisma.ticket.count(),

      // Total Orders
      prisma.order.count(),

      // Total Revenue (from paid tickets)
      prisma.ticket.aggregate({
        where: {
          status: 'paid',
        },
        _sum: {
          price: true,
        },
      }),

      // Active Movies
      prisma.movie.count({
        where: { isActive: true },
      }),

      // Upcoming Screenings (next 7 days)
      prisma.screening.count({
        where: {
          startTime: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Recent Orders (last 30 days)
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          tickets: {
            select: {
              id: true,
              price: true,
              status: true,
            },
          },
        },
      }),

      // Top Movies by ticket sales
      prisma.ticket.groupBy({
        by: ['screeningId'],
        _count: {
          id: true,
        },
        where: {
          status: {
            in: ['paid', 'used'],
          },
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      }),

      // User Statistics
      prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true,
        },
      }),
    ]);

    // Get movie details for top movies
    const topMoviesWithDetails = await Promise.all(
      topMovies.map(async (item) => {
        const screening = await prisma.screening.findUnique({
          where: { id: item.screeningId },
          include: {
            movie: {
              select: {
                id: true,
                title: true,
                image: true,
              },
            },
          },
        });
        return {
          movie: screening?.movie,
          ticketCount: item._count.id,
        };
      })
    );

    // Revenue by status
    const revenueByStatus = await prisma.ticket.groupBy({
      by: ['status'],
      _sum: {
        price: true,
      },
      _count: {
        id: true,
      },
    });

    // Orders by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    // Revenue over time (last 30 days)
    const revenueOverTime = await prisma.ticket.findMany({
      where: {
        status: 'paid',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        price: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group revenue by day
    const revenueByDay = revenueOverTime.reduce((acc: any, ticket) => {
      const date = new Date(ticket.createdAt).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += ticket.price;
      return acc;
    }, {});

    return {
      success: true,
      analytics: {
        overview: {
          totalUsers,
          totalMovies: activeMovies,
          totalScreenings,
          totalTickets,
          totalOrders,
          totalRevenue: totalRevenue._sum.price || 0,
          upcomingScreenings,
        },
        recentOrders,
        topMovies: topMoviesWithDetails.filter((item) => item.movie),
        userStats: userStats.reduce((acc: any, stat) => {
          acc[stat.role] = stat._count.id;
          return acc;
        }, {}),
        revenueByStatus,
        ordersByStatus,
        revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({
          date,
          revenue,
        })),
      },
    };
  } catch (error: any) {
    console.error('[Get Analytics] Error:', error);
    return {
      success: false,
      error: 'Վիճակագրությունը բեռնելիս սխալ է տեղի ունեցել',
      analytics: null,
    };
  }
}
