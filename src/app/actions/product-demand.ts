'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdminRole } from '@/lib/roles';
import { QUANTITY_ONLY_CATEGORIES } from '@/lib/product-units';

const EXCLUDED_CATEGORIES = [...QUANTITY_ONLY_CATEGORIES];
const MS_PER_DAY = 86_400_000;
const ANALYSIS_DAYS = 7;

export interface ProductDemandDailyPoint {
  date: string;
  soldAtCounter: number;
  fulfilledAtEntry: number;
}

export interface ProductDemandRow {
  id: number;
  name: string;
  category: string;
  stock: number;
  soldAtCounter: number;
  fulfilledAtEntry: number;
  baselineDemand: number;
  forecastDemand: number;
  suggestedOrder: number;
}

export interface MovieProductStat {
  productId: number;
  name: string;
  quantity: number;
}

export interface MovieDemandBreakdown {
  movieId: number;
  title: string;
  screeningCount: number;
  ticketsSold: number;
  soldAtCounter: number;
  fulfilledAtEntry: number;
  topProducts: MovieProductStat[];
}

export interface UpcomingMovieForecast {
  movieId: number;
  title: string;
  screeningCount: number;
  ticketsSold: number;
  ticketsReserved: number;
  pastScreenings: number;
  pastTicketsSold: number;
  pastProductsSold: number;
  coefficient: number;
  topProducts: Array<{
    productId: number;
    name: string;
    pastQuantity: number;
    forecastQuantity: number;
  }>;
}

export interface ProductDemandAnalytics {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  forecastPeriodStart: string;
  forecastPeriodEnd: string;
  nextOrderDate: string;
  daysUntilOrder: number;
  coefficient: number;
  pastScreenings: number;
  upcomingScreenings: number;
  pastTicketsSold: number;
  upcomingTicketsSold: number;
  upcomingTicketsReserved: number;
  dailySales: ProductDemandDailyPoint[];
  products: ProductDemandRow[];
  movieBreakdown: MovieDemandBreakdown[];
  upcomingMovies: UpcomingMovieForecast[];
  orderList: Array<{
    id: number;
    name: string;
    category: string;
    stock: number;
    forecastDemand: number;
    suggestedOrder: number;
  }>;
}

type ScreeningRef = {
  id: number;
  startTime: Date;
  movieId: number;
  movieTitle: string;
};

type ItemWithRelations = {
  id: number;
  quantity: number;
  fulfilledAt: Date | null;
  product: {
    id: number;
    name: string;
    category: string;
    stock: number;
  };
  order: {
    createdAt: Date;
    status: string;
    tickets: Array<{
      screening: {
        id: number;
        startTime: Date;
        movieId: number;
        movie: { title: string };
      };
    }>;
  };
  ticket: {
    screening: {
      id: number;
      startTime: Date;
      movieId: number;
      movie: { title: string };
    };
  } | null;
};

function localDateKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextOrderWednesday(now: Date): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const daysUntil = (3 - day + 7) % 7;
  date.setDate(date.getDate() + daysUntil);
  return date;
}

function resolveScreening(item: ItemWithRelations): ScreeningRef | null {
  if (item.ticket?.screening) {
    const screening = item.ticket.screening;
    return {
      id: screening.id,
      startTime: screening.startTime,
      movieId: screening.movieId,
      movieTitle: screening.movie.title,
    };
  }

  const tickets = item.order.tickets;
  if (tickets.length === 0) return null;

  if (tickets.length === 1) {
    const screening = tickets[0].screening;
    return {
      id: screening.id,
      startTime: screening.startTime,
      movieId: screening.movieId,
      movieTitle: screening.movie.title,
    };
  }

  const orderTime = item.order.createdAt.getTime();
  let closest = tickets[0];
  let closestDiff = Math.abs(
    closest.screening.startTime.getTime() - orderTime
  );
  for (let i = 1; i < tickets.length; i += 1) {
    const diff = Math.abs(tickets[i].screening.startTime.getTime() - orderTime);
    if (diff < closestDiff) {
      closest = tickets[i];
      closestDiff = diff;
    }
  }

  return {
    id: closest.screening.id,
    startTime: closest.screening.startTime,
    movieId: closest.screening.movieId,
    movieTitle: closest.screening.movie.title,
  };
}

function isExcludedCategory(category: string): boolean {
  return EXCLUDED_CATEGORIES.includes(
    category as (typeof EXCLUDED_CATEGORIES)[number]
  );
}

function buildDailySeries(
  start: Date,
  days: number
): ProductDemandDailyPoint[] {
  const points: ProductDemandDailyPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(start);
    day.setDate(day.getDate() - i);
    points.push({
      date: localDateKey(day),
      soldAtCounter: 0,
      fulfilledAtEntry: 0,
    });
  }
  return points;
}

function addToMap(
  map: Map<number, number>,
  key: number,
  quantity: number
) {
  map.set(key, (map.get(key) ?? 0) + quantity);
}

export async function getProductDemandAnalytics(): Promise<{
  success: boolean;
  error: string | null;
  data: ProductDemandAnalytics | null;
}> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user || !isAdminRole(user.role)) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  try {
    const now = new Date();
    const periodEnd = now;
    const periodStart = new Date(now.getTime() - ANALYSIS_DAYS * MS_PER_DAY);
    const forecastPeriodStart = now;
    const forecastPeriodEnd = new Date(
      now.getTime() + ANALYSIS_DAYS * MS_PER_DAY
    );
    const nextOrderDate = getNextOrderWednesday(now);
    const daysUntilOrder = Math.max(
      0,
      Math.ceil(
        (nextOrderDate.getTime() - now.getTime()) / MS_PER_DAY
      )
    );

    const itemInclude = {
      product: {
        select: {
          id: true,
          name: true,
          category: true,
          stock: true,
        },
      },
      ticket: {
        include: {
          screening: {
            include: {
              movie: { select: { title: true } },
            },
          },
        },
      },
      order: {
        select: {
          createdAt: true,
          status: true,
          tickets: {
            include: {
              screening: {
                include: {
                  movie: { select: { title: true } },
                },
              },
            },
          },
        },
      },
    } as const;

    const [
      soldItems,
      fulfilledItems,
      pastScreenings,
      upcomingScreenings,
      activeProducts,
    ] = await Promise.all([
      prisma.orderItem.findMany({
        where: {
          product: { category: { notIn: [...EXCLUDED_CATEGORIES] } },
          order: {
            status: 'completed',
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        },
        include: itemInclude,
      }),
      prisma.orderItem.findMany({
        where: {
          product: { category: { notIn: [...EXCLUDED_CATEGORIES] } },
          fulfilledAt: { gte: periodStart, lte: periodEnd },
          order: { status: { not: 'cancelled' } },
        },
        include: itemInclude,
      }),
      prisma.screening.findMany({
        where: {
          startTime: { gte: periodStart, lte: periodEnd },
        },
        select: {
          id: true,
          movieId: true,
          startTime: true,
          movie: { select: { title: true } },
          tickets: {
            where: { status: { in: ['paid', 'used'] } },
            select: { id: true },
          },
        },
      }),
      prisma.screening.findMany({
        where: {
          startTime: { gt: forecastPeriodStart, lte: forecastPeriodEnd },
        },
        select: {
          id: true,
          movieId: true,
          startTime: true,
          movie: { select: { title: true } },
          tickets: {
            select: { id: true, status: true },
          },
        },
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
          category: { notIn: [...EXCLUDED_CATEGORIES] },
        },
        select: {
          id: true,
          name: true,
          category: true,
          stock: true,
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const pastTicketsSold = pastScreenings.reduce(
      (sum, screening) => sum + screening.tickets.length,
      0
    );
    const upcomingTicketsSold = upcomingScreenings.reduce(
      (sum, screening) =>
        sum +
        screening.tickets.filter((ticket) =>
          ['paid', 'used'].includes(ticket.status)
        ).length,
      0
    );
    const upcomingTicketsReserved = upcomingScreenings.reduce(
      (sum, screening) =>
        sum +
        screening.tickets.filter((ticket) => ticket.status === 'reserved')
          .length,
      0
    );

    const screeningActivityCoeff =
      pastScreenings.length > 0
        ? upcomingScreenings.length / pastScreenings.length
        : upcomingScreenings.length > 0
          ? 1
          : 1;
    const ticketDemandCoeff =
      pastTicketsSold > 0
        ? (upcomingTicketsSold + upcomingTicketsReserved * 0.35) /
          pastTicketsSold
        : upcomingTicketsSold + upcomingTicketsReserved > 0
          ? 1
          : 1;
    const coefficient = Number(
      ((screeningActivityCoeff + ticketDemandCoeff) / 2).toFixed(2)
    );

    const dailySales = buildDailySeries(periodEnd, ANALYSIS_DAYS);
    const dailyByDate = new Map(
      dailySales.map((point) => [point.date, point])
    );

    const productSoldMap = new Map<number, number>();
    const productFulfilledMap = new Map<number, number>();
    const movieSoldMap = new Map<number, number>();
    const movieFulfilledMap = new Map<number, number>();
    const movieProductSoldMap = new Map<
      number,
      Map<number, { name: string; quantity: number }>
    >();
    const movieProductFulfilledMap = new Map<
      number,
      Map<number, { name: string; quantity: number }>
    >();
    const movieMeta = new Map<
      number,
      { title: string; screeningIds: Set<number>; ticketsSold: number }
    >();

    const ensureMovieMeta = (
      movieId: number,
      title: string,
      screeningId: number,
      ticketsSold: number
    ) => {
      let meta = movieMeta.get(movieId);
      if (!meta) {
        meta = { title, screeningIds: new Set(), ticketsSold: 0 };
        movieMeta.set(movieId, meta);
      }
      meta.screeningIds.add(screeningId);
      meta.ticketsSold += ticketsSold;
    };

    for (const screening of pastScreenings) {
      ensureMovieMeta(
        screening.movieId,
        screening.movie.title,
        screening.id,
        screening.tickets.length
      );
    }

    for (const item of soldItems as ItemWithRelations[]) {
      if (isExcludedCategory(item.product.category)) continue;

      const dateKey = localDateKey(item.order.createdAt);
      const day = dailyByDate.get(dateKey);
      if (day) day.soldAtCounter += item.quantity;

      addToMap(productSoldMap, item.product.id, item.quantity);

      const screening = resolveScreening(item);
      if (!screening) continue;
      if (
        screening.startTime < periodStart ||
        screening.startTime > periodEnd
      ) {
        continue;
      }

      addToMap(movieSoldMap, screening.movieId, item.quantity);
      let movieProducts = movieProductSoldMap.get(screening.movieId);
      if (!movieProducts) {
        movieProducts = new Map();
        movieProductSoldMap.set(screening.movieId, movieProducts);
      }
      const existingProduct = movieProducts.get(item.product.id);
      if (existingProduct) {
        existingProduct.quantity += item.quantity;
      } else {
        movieProducts.set(item.product.id, {
          name: item.product.name,
          quantity: item.quantity,
        });
      }
    }

    for (const item of fulfilledItems as ItemWithRelations[]) {
      if (isExcludedCategory(item.product.category)) continue;
      if (!item.fulfilledAt) continue;

      const dateKey = localDateKey(item.fulfilledAt);
      const day = dailyByDate.get(dateKey);
      if (day) day.fulfilledAtEntry += item.quantity;

      addToMap(productFulfilledMap, item.product.id, item.quantity);

      const screening = resolveScreening(item);
      if (!screening) continue;
      if (
        screening.startTime < periodStart ||
        screening.startTime > periodEnd
      ) {
        continue;
      }

      addToMap(movieFulfilledMap, screening.movieId, item.quantity);
      let movieProducts = movieProductFulfilledMap.get(screening.movieId);
      if (!movieProducts) {
        movieProducts = new Map();
        movieProductFulfilledMap.set(screening.movieId, movieProducts);
      }
      const existingProduct = movieProducts.get(item.product.id);
      if (existingProduct) {
        existingProduct.quantity += item.quantity;
      } else {
        movieProducts.set(item.product.id, {
          name: item.product.name,
          quantity: item.quantity,
        });
      }
    }

    const products: ProductDemandRow[] = activeProducts.map((product) => {
      const soldAtCounter = productSoldMap.get(product.id) ?? 0;
      const fulfilledAtEntry = productFulfilledMap.get(product.id) ?? 0;
      const baselineDemand = Math.max(soldAtCounter, fulfilledAtEntry);
      const forecastDemand = Math.ceil(baselineDemand * coefficient);
      const suggestedOrder = Math.max(0, forecastDemand - product.stock);

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        stock: product.stock,
        soldAtCounter,
        fulfilledAtEntry,
        baselineDemand,
        forecastDemand,
        suggestedOrder,
      };
    });

    products.sort((a, b) => b.baselineDemand - a.baselineDemand);

    const movieBreakdown: MovieDemandBreakdown[] = Array.from(
      movieMeta.entries()
    )
      .map(([movieId, meta]) => {
        const productTotals = new Map<number, MovieProductStat>();

        for (const [productId, product] of (
          movieProductSoldMap.get(movieId) ?? new Map()
        ).entries()) {
          productTotals.set(productId, {
            productId,
            name: product.name,
            quantity: product.quantity,
          });
        }

        for (const [productId, product] of (
          movieProductFulfilledMap.get(movieId) ?? new Map()
        ).entries()) {
          const existing = productTotals.get(productId);
          if (existing) {
            existing.quantity = Math.max(existing.quantity, product.quantity);
          } else {
            productTotals.set(productId, {
              productId,
              name: product.name,
              quantity: product.quantity,
            });
          }
        }

        const topProducts = Array.from(productTotals.values())
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 8);

        return {
          movieId,
          title: meta.title,
          screeningCount: meta.screeningIds.size,
          ticketsSold: meta.ticketsSold,
          soldAtCounter: movieSoldMap.get(movieId) ?? 0,
          fulfilledAtEntry: movieFulfilledMap.get(movieId) ?? 0,
          topProducts,
        };
      })
      .sort(
        (a, b) =>
          Math.max(b.soldAtCounter, b.fulfilledAtEntry) -
          Math.max(a.soldAtCounter, a.fulfilledAtEntry)
      );

    const historicalByMovie = new Map<
      number,
      {
        screenings: number;
        ticketsSold: number;
        productsSold: number;
        productMap: Map<number, { name: string; quantity: number }>;
      }
    >();

    const historicalLookbackStart = new Date(
      now.getTime() - 90 * MS_PER_DAY
    );
    const historicalItems = await prisma.orderItem.findMany({
      where: {
        product: { category: { notIn: [...EXCLUDED_CATEGORIES] } },
        order: {
          status: 'completed',
          createdAt: { gte: historicalLookbackStart, lte: periodEnd },
        },
      },
      include: itemInclude,
    });

    const historicalScreenings = await prisma.screening.findMany({
      where: {
        startTime: { gte: historicalLookbackStart, lt: periodStart },
      },
      select: {
        id: true,
        movieId: true,
        tickets: {
          where: { status: { in: ['paid', 'used'] } },
          select: { id: true },
        },
      },
    });

    const historicalScreeningCount = new Map<number, number>();
    const historicalTicketCount = new Map<number, number>();
    for (const screening of historicalScreenings) {
      historicalScreeningCount.set(
        screening.movieId,
        (historicalScreeningCount.get(screening.movieId) ?? 0) + 1
      );
      historicalTicketCount.set(
        screening.movieId,
        (historicalTicketCount.get(screening.movieId) ?? 0) +
          screening.tickets.length
      );
    }

    for (const item of historicalItems as ItemWithRelations[]) {
      const screening = resolveScreening(item);
      if (!screening) continue;
      if (
        screening.startTime < historicalLookbackStart ||
        screening.startTime >= periodStart
      ) {
        continue;
      }

      let entry = historicalByMovie.get(screening.movieId);
      if (!entry) {
        entry = {
          screenings: historicalScreeningCount.get(screening.movieId) ?? 0,
          ticketsSold: historicalTicketCount.get(screening.movieId) ?? 0,
          productsSold: 0,
          productMap: new Map(),
        };
        historicalByMovie.set(screening.movieId, entry);
      }

      entry.productsSold += item.quantity;
      const productEntry = entry.productMap.get(item.product.id);
      if (productEntry) {
        productEntry.quantity += item.quantity;
      } else {
        entry.productMap.set(item.product.id, {
          name: item.product.name,
          quantity: item.quantity,
        });
      }
    }

    const upcomingMovieMap = new Map<
      number,
      {
        title: string;
        screeningCount: number;
        ticketsSold: number;
        ticketsReserved: number;
      }
    >();

    for (const screening of upcomingScreenings) {
      const existing = upcomingMovieMap.get(screening.movieId);
      const sold = screening.tickets.filter((ticket) =>
        ['paid', 'used'].includes(ticket.status)
      ).length;
      const reserved = screening.tickets.filter(
        (ticket) => ticket.status === 'reserved'
      ).length;

      if (existing) {
        existing.screeningCount += 1;
        existing.ticketsSold += sold;
        existing.ticketsReserved += reserved;
      } else {
        upcomingMovieMap.set(screening.movieId, {
          title: screening.movie.title,
          screeningCount: 1,
          ticketsSold: sold,
          ticketsReserved: reserved,
        });
      }
    }

    const upcomingMovies: UpcomingMovieForecast[] = Array.from(
      upcomingMovieMap.entries()
    )
      .map(([movieId, upcoming]) => {
        const history = historicalByMovie.get(movieId);
        const pastScreeningCount = history?.screenings ?? 0;
        const pastTicketCount = history?.ticketsSold ?? 0;
        const pastProductsSold = history?.productsSold ?? 0;

        const movieCoeff =
          pastTicketCount > 0
            ? (upcoming.ticketsSold + upcoming.ticketsReserved * 0.35) /
              pastTicketCount
            : pastScreeningCount > 0
              ? upcoming.screeningCount / pastScreeningCount
              : coefficient;

        const topProducts = Array.from(history?.productMap.entries() ?? [])
          .map(([productId, product]) => ({
            productId,
            name: product.name,
            pastQuantity: product.quantity,
            forecastQuantity: Math.ceil(product.quantity * movieCoeff),
          }))
          .sort((a, b) => b.forecastQuantity - a.forecastQuantity)
          .slice(0, 6);

        return {
          movieId,
          title: upcoming.title,
          screeningCount: upcoming.screeningCount,
          ticketsSold: upcoming.ticketsSold,
          ticketsReserved: upcoming.ticketsReserved,
          pastScreenings: pastScreeningCount,
          pastTicketsSold: pastTicketCount,
          pastProductsSold,
          coefficient: Number(movieCoeff.toFixed(2)),
          topProducts,
        };
      })
      .sort(
        (a, b) =>
          b.ticketsSold +
          b.ticketsReserved -
          (a.ticketsSold + a.ticketsReserved)
      );

    const orderList = products
      .filter((product) => product.suggestedOrder > 0)
      .map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        stock: product.stock,
        forecastDemand: product.forecastDemand,
        suggestedOrder: product.suggestedOrder,
      }));

    return {
      success: true,
      error: null,
      data: {
        generatedAt: now.toISOString(),
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        forecastPeriodStart: forecastPeriodStart.toISOString(),
        forecastPeriodEnd: forecastPeriodEnd.toISOString(),
        nextOrderDate: nextOrderDate.toISOString(),
        daysUntilOrder,
        coefficient,
        pastScreenings: pastScreenings.length,
        upcomingScreenings: upcomingScreenings.length,
        pastTicketsSold,
        upcomingTicketsSold,
        upcomingTicketsReserved,
        dailySales,
        products,
        movieBreakdown,
        upcomingMovies,
        orderList,
      },
    };
  } catch (error) {
    console.error('[Get Product Demand Analytics] Error:', error);
    return {
      success: false,
      error: 'Պահանջարկի վերլուծությունը բեռնելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}
