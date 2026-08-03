'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdminRole } from '@/lib/roles';
import { QUANTITY_ONLY_CATEGORIES } from '@/lib/product-units';

/**
 * Ապրանքների պահանջարկի կանխատեսում և պատվերի հաշվարկ։
 *
 * Մոդելը՝ դասական inventory forecasting.
 *  1. Սպառման փաստ  — ամեն OrderItem-ը մեկ սպառման իրադարձություն է
 *                     (fulfilledAt, կամ completed պատվերի createdAt)
 *  2. Attach rate   — քանի միավոր է սպառվում մեկ տոմսի հաշվով
 *                     (գլոբալ + ըստ ֆիլմի, քանի որ ֆիլմը փոխում է սպառումը)
 *  3. Ambient       — առանց տոմսի վաճառք (միայն դրամարկղ)՝ օրական ռիթմ
 *  4. Կանխատեսում   — առաջիկա ցուցադրությունների սպասվող տոմսեր × attach rate
 *  5. Պահուստ       — max(ստատիստիկ safety stock, 50% կանխատեսվածից)
 *  6. Պատվեր        — թիրախ − փաստացի հասանելի պաշար
 */

const EXCLUDED_CATEGORIES = [...QUANTITY_ONLY_CATEGORIES];
const MS_PER_DAY = 86_400_000;

/** Ցուցադրվող շաբաթ */
const ANALYSIS_DAYS = 7;
/** Պատմություն՝ պահանջարկի և ցրվածության գնահատման համար */
const HISTORY_DAYS = 28;
/** Չսպառվելու պահուստ՝ 50% */
const SAFETY_BUFFER = 0.5;
/** Սպասարկման մակարդակ ~95% (z-score) */
const SERVICE_Z = 1.65;
/** Չվճարված ամրագրումների իրացման հավանականություն */
const PENDING_TICKET_WEIGHT = 0.4;
/** Պատմական միջինից կանխատեսելու զգուշավորության գործակից */
const PROJECTION_DAMPING = 0.9;
/** Ֆիլմի սեփական attach rate-ը վստահելի է այս տոմսերից հետո */
const MOVIE_RATE_MIN_TICKETS = 25;
/** Ֆիլմի սեփական rate-ի կշիռը գլոբալի նկատմամբ */
const MOVIE_RATE_WEIGHT = 0.7;
/** Չսպառված (ամրագրված) պատվերները հաշվում ենք այս խորությամբ */
const PENDING_LOOKBACK_DAYS = 60;
/** Պատվերի օր՝ չորեքշաբթի */
const ORDER_WEEKDAY = 3;

export type DemandConfidence = 'high' | 'medium' | 'low';

export interface ProductDemandDailyPoint {
  date: string;
  consumption: number;
  tickets: number;
}

export interface ProductDemandRow {
  id: number;
  name: string;
  category: string;
  /** Բազայում գրանցված պաշար */
  stock: number;
  /** Վաճառված/ամրագրված, բայց դեռ չհանված պաշար */
  committed: number;
  /** Իրական հասանելի պաշար */
  available: number;
  soldLast7: number;
  soldHistory: number;
  /** Օրական միջին սպառում (պատմություն) */
  avgDaily: number;
  /** Սպառում 100 տոմսի հաշվով */
  attachPer100Tickets: number;
  /** Սպասվող սպառում մինչև հաջորդ մատակարարում */
  expectedDemand: number;
  /** Սպասվող սպառում մինչև ապրանքի ստացում */
  demandUntilDelivery: number;
  safetyStock: number;
  targetStock: number;
  suggestedOrder: number;
  /** Քանի օր կբավարարի ներկա պաշարը */
  daysOfStock: number | null;
  isCritical: boolean;
  confidence: DemandConfidence;
}

export interface MovieProductStat {
  productId: number;
  name: string;
  quantity: number;
  per100Tickets: number;
}

export interface MovieDemandBreakdown {
  movieId: number;
  title: string;
  screeningCount: number;
  tickets: number;
  consumption: number;
  /** Միավոր մեկ տոմսի հաշվով */
  perTicket: number;
  topProducts: MovieProductStat[];
}

export interface UpcomingMovieForecast {
  movieId: number;
  title: string;
  screeningCount: number;
  ticketsSold: number;
  ticketsPending: number;
  expectedTickets: number;
  pastScreenings: number;
  pastTickets: number;
  topProducts: Array<{
    productId: number;
    name: string;
    per100Tickets: number;
    forecastQuantity: number;
  }>;
}

export interface ProductDemandOrderRow {
  id: number;
  name: string;
  category: string;
  available: number;
  expectedDemand: number;
  safetyStock: number;
  targetStock: number;
  suggestedOrder: number;
  isCritical: boolean;
}

export interface ProductDemandAnalytics {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  historyStart: string;
  historyDays: number;
  nextOrderDate: string;
  deliveryDate: string;
  nextDeliveryDate: string;
  daysUntilOrder: number;
  daysUntilDelivery: number;
  /** Ծածկման օրեր՝ մինչև հաջորդ մատակարարում */
  coverDays: number;
  safetyBufferPct: number;
  serviceZ: number;
  historyScreenings: number;
  historyTickets: number;
  coverScreenings: number;
  coverExpectedTickets: number;
  dailySales: ProductDemandDailyPoint[];
  products: ProductDemandRow[];
  movieBreakdown: MovieDemandBreakdown[];
  upcomingMovies: UpcomingMovieForecast[];
  orderList: ProductDemandOrderRow[];
  totals: {
    criticalCount: number;
    orderProductCount: number;
    orderUnits: number;
    scheduleMissing: boolean;
  };
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

const DEAD_ORDER_STATUSES = new Set(['cancelled', 'failed']);
const SOLD_TICKET_STATUSES = ['paid', 'used'];
const PENDING_TICKET_STATUSES = ['reserved', 'awaiting_payment'];

function localDateKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Հաջորդ պատվերի օրը (չորեքշաբթի, ներառյալ այսօրը) */
function getNextOrderDate(now: Date): Date {
  const date = startOfDay(now);
  date.setDate(date.getDate() + ((ORDER_WEEKDAY - date.getDay() + 7) % 7));
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

/** Ապրանքի տողը կապել ցուցադրության հետ (ուղիղ տոմսով կամ պատվերի տոմսերով) */
function resolveScreening(item: ItemWithRelations): ScreeningRef | null {
  const toRef = (screening: {
    id: number;
    startTime: Date;
    movieId: number;
    movie: { title: string };
  }): ScreeningRef => ({
    id: screening.id,
    startTime: screening.startTime,
    movieId: screening.movieId,
    movieTitle: screening.movie.title,
  });

  if (item.ticket?.screening) return toRef(item.ticket.screening);

  const tickets = item.order.tickets;
  if (tickets.length === 0) return null;
  if (tickets.length === 1) return toRef(tickets[0].screening);

  // Բազմաթիվ տոմս՝ վերցնում ենք պատվերի պահին ամենամոտ ցուցադրությունը
  const orderTime = item.order.createdAt.getTime();
  let closest = tickets[0];
  let closestDiff = Math.abs(closest.screening.startTime.getTime() - orderTime);
  for (let i = 1; i < tickets.length; i += 1) {
    const diff = Math.abs(tickets[i].screening.startTime.getTime() - orderTime);
    if (diff < closestDiff) {
      closest = tickets[i];
      closestDiff = diff;
    }
  }
  return toRef(closest.screening);
}

/** Սպառման պահը՝ պահեստից հանելը, կամ դրամարկղի/օնլայն ավարտված վաճառքը */
function resolveConsumedAt(item: ItemWithRelations): Date | null {
  if (item.fulfilledAt) return item.fulfilledAt;
  if (item.order.status === 'completed') return item.order.createdAt;
  return null;
}

function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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
    const periodStart = new Date(now.getTime() - ANALYSIS_DAYS * MS_PER_DAY);
    const historyStart = new Date(now.getTime() - HISTORY_DAYS * MS_PER_DAY);
    const pendingLookback = new Date(
      now.getTime() - PENDING_LOOKBACK_DAYS * MS_PER_DAY
    );

    // Պատվեր չորեքշաբթի → ստացում հինգշաբթի → հաջորդ մատակարարում մեկ շաբաթ անց
    const nextOrderDate = getNextOrderDate(now);
    const deliveryDate = addDays(nextOrderDate, 1);
    const nextDeliveryDate = addDays(deliveryDate, 7);
    const daysUntilOrder = Math.max(
      0,
      Math.ceil((nextOrderDate.getTime() - now.getTime()) / MS_PER_DAY)
    );
    const daysUntilDelivery = Math.max(
      1,
      Math.ceil((deliveryDate.getTime() - now.getTime()) / MS_PER_DAY)
    );
    const coverDays = Math.max(
      daysUntilDelivery + 1,
      Math.ceil((nextDeliveryDate.getTime() - now.getTime()) / MS_PER_DAY)
    );

    const itemInclude = {
      product: { select: { id: true, name: true, category: true } },
      ticket: {
        select: {
          screening: {
            select: {
              id: true,
              startTime: true,
              movieId: true,
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
            select: {
              screening: {
                select: {
                  id: true,
                  startTime: true,
                  movieId: true,
                  movie: { select: { title: true } },
                },
              },
            },
          },
        },
      },
    } as const;

    const [items, historyScreenings, coverScreenings, activeProducts] =
      await Promise.all([
        prisma.orderItem.findMany({
          where: {
            product: { category: { notIn: [...EXCLUDED_CATEGORIES] } },
            OR: [
              { fulfilledAt: { gte: historyStart } },
              { order: { createdAt: { gte: pendingLookback } } },
            ],
          },
          include: itemInclude,
        }),
        prisma.screening.findMany({
          where: { startTime: { gte: historyStart, lte: now } },
          select: {
            id: true,
            movieId: true,
            startTime: true,
            movie: { select: { title: true } },
            tickets: {
              where: { status: { in: SOLD_TICKET_STATUSES } },
              select: { id: true },
            },
          },
        }),
        prisma.screening.findMany({
          where: { startTime: { gt: now, lte: nextDeliveryDate } },
          select: {
            id: true,
            movieId: true,
            startTime: true,
            movie: { select: { title: true } },
            hall: { select: { capacity: true } },
            tickets: { select: { id: true, status: true } },
          },
        }),
        prisma.product.findMany({
          where: {
            isActive: true,
            category: { notIn: [...EXCLUDED_CATEGORIES] },
          },
          select: { id: true, name: true, category: true, stock: true },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        }),
      ]);

    // ── Պատմական տոմսերը ─────────────────────────────────────────────────────
    let historyTickets = 0;
    const movieHistoryTickets = new Map<number, number>();
    const movieHistoryScreenings = new Map<number, number>();
    const movieTitles = new Map<number, string>();
    const ticketsByDate = new Map<string, number>();

    for (const screening of historyScreenings) {
      const sold = screening.tickets.length;
      historyTickets += sold;
      movieTitles.set(screening.movieId, screening.movie.title);
      movieHistoryTickets.set(
        screening.movieId,
        (movieHistoryTickets.get(screening.movieId) ?? 0) + sold
      );
      movieHistoryScreenings.set(
        screening.movieId,
        (movieHistoryScreenings.get(screening.movieId) ?? 0) + 1
      );
      const key = localDateKey(screening.startTime);
      ticketsByDate.set(key, (ticketsByDate.get(key) ?? 0) + sold);
    }

    // ── Սպառման իրադարձությունները ───────────────────────────────────────────
    type ProductStats = {
      historyQty: number;
      last7Qty: number;
      ticketLinkedQty: number;
      ambientQty: number;
      committed: number;
      dailyQty: Map<string, number>;
    };

    const statsByProduct = new Map<number, ProductStats>();
    const ensureStats = (productId: number): ProductStats => {
      let stats = statsByProduct.get(productId);
      if (!stats) {
        stats = {
          historyQty: 0,
          last7Qty: 0,
          ticketLinkedQty: 0,
          ambientQty: 0,
          committed: 0,
          dailyQty: new Map(),
        };
        statsByProduct.set(productId, stats);
      }
      return stats;
    };

    // Ֆիլմ × ապրանք սպառում (attach rate-ի համար)
    const movieProductQty = new Map<number, Map<number, number>>();
    const movieConsumption = new Map<number, number>();
    const consumptionByDate = new Map<string, number>();

    for (const raw of items as ItemWithRelations[]) {
      const item = raw;
      if (DEAD_ORDER_STATUSES.has(item.order.status)) continue;

      const consumedAt = resolveConsumedAt(item);
      const screening = resolveScreening(item);

      if (!consumedAt) {
        // Դեռ չսպառված՝ ամրագրված պաշար (կհանվի մուտքի ժամանակ)
        const isFresh = item.order.createdAt >= pendingLookback;
        const screeningAhead = !screening || screening.startTime >= now;
        if (isFresh && screeningAhead) {
          ensureStats(item.product.id).committed += item.quantity;
        }
        continue;
      }

      if (consumedAt < historyStart || consumedAt > now) continue;

      const stats = ensureStats(item.product.id);
      stats.historyQty += item.quantity;
      if (consumedAt >= periodStart) stats.last7Qty += item.quantity;

      const dateKey = localDateKey(consumedAt);
      stats.dailyQty.set(
        dateKey,
        (stats.dailyQty.get(dateKey) ?? 0) + item.quantity
      );
      consumptionByDate.set(
        dateKey,
        (consumptionByDate.get(dateKey) ?? 0) + item.quantity
      );

      const linkedToHistoryScreening =
        screening !== null &&
        screening.startTime >= historyStart &&
        screening.startTime <= now;

      if (linkedToHistoryScreening && screening) {
        stats.ticketLinkedQty += item.quantity;
        movieTitles.set(screening.movieId, screening.movieTitle);
        movieConsumption.set(
          screening.movieId,
          (movieConsumption.get(screening.movieId) ?? 0) + item.quantity
        );
        let perProduct = movieProductQty.get(screening.movieId);
        if (!perProduct) {
          perProduct = new Map();
          movieProductQty.set(screening.movieId, perProduct);
        }
        perProduct.set(
          item.product.id,
          (perProduct.get(item.product.id) ?? 0) + item.quantity
        );
      } else {
        stats.ambientQty += item.quantity;
      }
    }

    // ── Attach rate՝ միավոր մեկ տոմսի հաշվով ─────────────────────────────────
    const globalAttachRate = new Map<number, number>();
    if (historyTickets > 0) {
      for (const [productId, stats] of statsByProduct.entries()) {
        globalAttachRate.set(productId, stats.ticketLinkedQty / historyTickets);
      }
    }

    const movieAttachRate = (movieId: number, productId: number): number => {
      const globalRate = globalAttachRate.get(productId) ?? 0;
      const tickets = movieHistoryTickets.get(movieId) ?? 0;
      if (tickets < MOVIE_RATE_MIN_TICKETS) return globalRate;
      const qty = movieProductQty.get(movieId)?.get(productId) ?? 0;
      const movieRate = qty / tickets;
      return (
        movieRate * MOVIE_RATE_WEIGHT + globalRate * (1 - MOVIE_RATE_WEIGHT)
      );
    };

    // ── Առաջիկա ցուցադրությունների սպասվող տոմսերը ────────────────────────────
    const globalAvgPerScreening =
      historyScreenings.length > 0 ? historyTickets / historyScreenings.length : 0;

    type CoverScreening = {
      movieId: number;
      startTime: Date;
      expectedTickets: number;
    };

    const coverScreeningForecasts: CoverScreening[] = coverScreenings.map(
      (screening) => {
        const sold = screening.tickets.filter((ticket) =>
          SOLD_TICKET_STATUSES.includes(ticket.status)
        ).length;
        const pending = screening.tickets.filter((ticket) =>
          PENDING_TICKET_STATUSES.includes(ticket.status)
        ).length;
        const known = sold + pending * PENDING_TICKET_WEIGHT;

        const movieScreeningCount = movieHistoryScreenings.get(screening.movieId) ?? 0;
        const movieAvg =
          movieScreeningCount > 0
            ? (movieHistoryTickets.get(screening.movieId) ?? 0) /
              movieScreeningCount
            : globalAvgPerScreening;
        const projection = movieAvg * PROJECTION_DAMPING;

        const capacity = screening.hall?.capacity ?? Number.POSITIVE_INFINITY;
        const expectedTickets = Math.min(
          capacity,
          Math.max(known, projection)
        );

        return {
          movieId: screening.movieId,
          startTime: screening.startTime,
          expectedTickets,
        };
      }
    );

    const coverExpectedTickets = coverScreeningForecasts.reduce(
      (sum, screening) => sum + screening.expectedTickets,
      0
    );

    // Ժամանակացույցը դեռ լրացված չէ → հենվում ենք պատմական օրական ռիթմի վրա
    const scheduleMissing = coverScreenings.length === 0;

    // ── Օրական դինամիկա (վերջին 7 օր) ────────────────────────────────────────
    const dailySales: ProductDemandDailyPoint[] = [];
    for (let i = ANALYSIS_DAYS - 1; i >= 0; i -= 1) {
      const day = addDays(now, -i);
      const key = localDateKey(day);
      dailySales.push({
        date: key,
        consumption: consumptionByDate.get(key) ?? 0,
        tickets: ticketsByDate.get(key) ?? 0,
      });
    }

    // ── Ապրանք առ ապրանք հաշվարկ ─────────────────────────────────────────────
    const historyDayKeys: string[] = [];
    for (let i = HISTORY_DAYS - 1; i >= 0; i -= 1) {
      historyDayKeys.push(localDateKey(addDays(now, -i)));
    }

    const products: ProductDemandRow[] = activeProducts.map((product) => {
      const stats = statsByProduct.get(product.id);
      const historyQty = stats?.historyQty ?? 0;
      const last7Qty = stats?.last7Qty ?? 0;
      const committed = stats?.committed ?? 0;
      const available = Math.max(0, product.stock - committed);

      const avgDaily = historyQty / HISTORY_DAYS;
      const ambientDaily = (stats?.ambientQty ?? 0) / HISTORY_DAYS;

      // Ցուցադրություններից բխող սպասվող սպառում
      let ticketDrivenCover = 0;
      let ticketDrivenUntilDelivery = 0;
      for (const screening of coverScreeningForecasts) {
        const rate = movieAttachRate(screening.movieId, product.id);
        if (rate <= 0) continue;
        const demand = screening.expectedTickets * rate;
        ticketDrivenCover += demand;
        if (screening.startTime <= deliveryDate) {
          ticketDrivenUntilDelivery += demand;
        }
      }

      const modelCover = ticketDrivenCover + ambientDaily * coverDays;
      const baselineCover = avgDaily * coverDays;
      const expectedDemand = Math.max(modelCover, baselineCover);

      const modelUntilDelivery =
        ticketDrivenUntilDelivery + ambientDaily * daysUntilDelivery;
      const demandUntilDelivery = Math.max(
        modelUntilDelivery,
        avgDaily * daysUntilDelivery
      );

      // Ցրվածություն՝ ստատիստիկ safety stock
      const dailySeries = historyDayKeys.map(
        (key) => stats?.dailyQty.get(key) ?? 0
      );
      const stdDev = sampleStdDev(dailySeries);
      const statisticalSafety = SERVICE_Z * stdDev * Math.sqrt(coverDays);
      const bufferSafety = expectedDemand * SAFETY_BUFFER;
      const safetyStock =
        expectedDemand > 0 ? Math.max(statisticalSafety, bufferSafety) : 0;

      const targetStock = Math.ceil(expectedDemand + safetyStock);
      const suggestedOrder = Math.max(0, targetStock - available);

      const dailyForecast = expectedDemand / coverDays;
      const daysOfStock =
        dailyForecast > 0 ? round2(available / dailyForecast) : null;
      const isCritical =
        expectedDemand > 0 && available < Math.ceil(demandUntilDelivery);

      const activeDays = stats
        ? historyDayKeys.filter((key) => (stats.dailyQty.get(key) ?? 0) > 0)
            .length
        : 0;
      const confidence: DemandConfidence =
        activeDays >= 8 ? 'high' : activeDays >= 3 ? 'medium' : 'low';

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        stock: product.stock,
        committed,
        available,
        soldLast7: last7Qty,
        soldHistory: historyQty,
        avgDaily: round2(avgDaily),
        attachPer100Tickets: round2(
          (globalAttachRate.get(product.id) ?? 0) * 100
        ),
        expectedDemand: Math.ceil(expectedDemand),
        demandUntilDelivery: Math.ceil(demandUntilDelivery),
        safetyStock: Math.ceil(safetyStock),
        targetStock,
        suggestedOrder,
        daysOfStock,
        isCritical,
        confidence,
      };
    });

    // Կրիտիկականները առաջինը, ապա՝ ըստ պատվերի ծավալի
    products.sort((a, b) => {
      if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
      if (b.suggestedOrder !== a.suggestedOrder) {
        return b.suggestedOrder - a.suggestedOrder;
      }
      return b.expectedDemand - a.expectedDemand;
    });

    const productNames = new Map(
      activeProducts.map((product) => [product.id, product.name])
    );

    // ── Վերջին շաբաթը ըստ ֆիլմերի ────────────────────────────────────────────
    const movieBreakdown: MovieDemandBreakdown[] = Array.from(
      movieHistoryScreenings.keys()
    )
      .map((movieId) => {
        const tickets = movieHistoryTickets.get(movieId) ?? 0;
        const consumption = movieConsumption.get(movieId) ?? 0;
        const perProduct = movieProductQty.get(movieId);

        const topProducts: MovieProductStat[] = Array.from(
          perProduct?.entries() ?? []
        )
          .map(([productId, quantity]) => ({
            productId,
            name: productNames.get(productId) ?? `#${productId}`,
            quantity,
            per100Tickets: tickets > 0 ? round2((quantity / tickets) * 100) : 0,
          }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 8);

        return {
          movieId,
          title: movieTitles.get(movieId) ?? `#${movieId}`,
          screeningCount: movieHistoryScreenings.get(movieId) ?? 0,
          tickets,
          consumption,
          perTicket: tickets > 0 ? round2(consumption / tickets) : 0,
          topProducts,
        };
      })
      .filter((movie) => movie.tickets > 0 || movie.consumption > 0)
      .sort((a, b) => b.consumption - a.consumption);

    // ── Առաջիկա ֆիլմերի կանխատեսում ──────────────────────────────────────────
    const upcomingByMovie = new Map<
      number,
      {
        title: string;
        screeningCount: number;
        ticketsSold: number;
        ticketsPending: number;
        expectedTickets: number;
      }
    >();

    coverScreenings.forEach((screening, index) => {
      const sold = screening.tickets.filter((ticket) =>
        SOLD_TICKET_STATUSES.includes(ticket.status)
      ).length;
      const pending = screening.tickets.filter((ticket) =>
        PENDING_TICKET_STATUSES.includes(ticket.status)
      ).length;
      const expected = coverScreeningForecasts[index]?.expectedTickets ?? 0;

      const existing = upcomingByMovie.get(screening.movieId);
      if (existing) {
        existing.screeningCount += 1;
        existing.ticketsSold += sold;
        existing.ticketsPending += pending;
        existing.expectedTickets += expected;
      } else {
        upcomingByMovie.set(screening.movieId, {
          title: screening.movie.title,
          screeningCount: 1,
          ticketsSold: sold,
          ticketsPending: pending,
          expectedTickets: expected,
        });
      }
    });

    const upcomingMovies: UpcomingMovieForecast[] = Array.from(
      upcomingByMovie.entries()
    )
      .map(([movieId, upcoming]) => {
        const productIds = new Set<number>([
          ...(movieProductQty.get(movieId)?.keys() ?? []),
          ...globalAttachRate.keys(),
        ]);

        const topProducts = Array.from(productIds)
          .map((productId) => {
            const rate = movieAttachRate(movieId, productId);
            return {
              productId,
              name: productNames.get(productId) ?? `#${productId}`,
              per100Tickets: round2(rate * 100),
              forecastQuantity: Math.ceil(upcoming.expectedTickets * rate),
            };
          })
          .filter((product) => product.forecastQuantity > 0)
          .sort((a, b) => b.forecastQuantity - a.forecastQuantity)
          .slice(0, 6);

        return {
          movieId,
          title: upcoming.title,
          screeningCount: upcoming.screeningCount,
          ticketsSold: upcoming.ticketsSold,
          ticketsPending: upcoming.ticketsPending,
          expectedTickets: Math.round(upcoming.expectedTickets),
          pastScreenings: movieHistoryScreenings.get(movieId) ?? 0,
          pastTickets: movieHistoryTickets.get(movieId) ?? 0,
          topProducts,
        };
      })
      .sort((a, b) => b.expectedTickets - a.expectedTickets);

    const orderList: ProductDemandOrderRow[] = products
      .filter((product) => product.suggestedOrder > 0)
      .map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        available: product.available,
        expectedDemand: product.expectedDemand,
        safetyStock: product.safetyStock,
        targetStock: product.targetStock,
        suggestedOrder: product.suggestedOrder,
        isCritical: product.isCritical,
      }));

    return {
      success: true,
      error: null,
      data: {
        generatedAt: now.toISOString(),
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString(),
        historyStart: historyStart.toISOString(),
        historyDays: HISTORY_DAYS,
        nextOrderDate: nextOrderDate.toISOString(),
        deliveryDate: deliveryDate.toISOString(),
        nextDeliveryDate: nextDeliveryDate.toISOString(),
        daysUntilOrder,
        daysUntilDelivery,
        coverDays,
        safetyBufferPct: SAFETY_BUFFER,
        serviceZ: SERVICE_Z,
        historyScreenings: historyScreenings.length,
        historyTickets,
        coverScreenings: coverScreenings.length,
        coverExpectedTickets: Math.round(coverExpectedTickets),
        dailySales,
        products,
        movieBreakdown,
        upcomingMovies,
        orderList,
        totals: {
          criticalCount: products.filter((product) => product.isCritical).length,
          orderProductCount: orderList.length,
          orderUnits: orderList.reduce(
            (sum, product) => sum + product.suggestedOrder,
            0
          ),
          scheduleMissing,
        },
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
