'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdminRole } from '@/lib/roles';

export interface DailyReportProductRow {
  productId: number;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  missingCost: boolean;
  /** Տոմսի հետ / միայն ապրանք */
  withTicketQty: number;
  productOnlyQty: number;
}

export interface DailyReportTicketRow {
  movieTitle: string;
  count: number;
  revenue: number;
}

export interface DailyReportPaymentSplit {
  cash: number;
  card: number;
  other: number;
}

export interface BoxOfficeDailyReport {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  tickets: {
    soldCount: number;
    revenue: number;
    cancelledCount: number;
    cancelledRevenue: number;
    netRevenue: number;
    byMovie: DailyReportTicketRow[];
    byPayment: DailyReportPaymentSplit;
  };
  products: {
    soldUnits: number;
    orderCount: number;
    revenue: number;
    cost: number;
    profit: number;
    returnedAmount: number;
    netRevenue: number;
    netProfit: number;
    missingCostCount: number;
    byProduct: DailyReportProductRow[];
    byPayment: DailyReportPaymentSplit;
  };
  totals: {
    grossRevenue: number;
    refunds: number;
    netRevenue: number;
    productCost: number;
    netProfit: number;
    byPayment: DailyReportPaymentSplit;
  };
}

function startOfLocalDay(now = new Date()): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizePayment(method: string | null | undefined): keyof DailyReportPaymentSplit {
  if (method === 'card') return 'card';
  if (method === 'cash' || method === 'counter') return 'cash';
  return 'other';
}

function emptyPayment(): DailyReportPaymentSplit {
  return { cash: 0, card: 0, other: 0 };
}

function addPayment(
  split: DailyReportPaymentSplit,
  method: string | null | undefined,
  amount: number
) {
  split[normalizePayment(method)] += amount;
}

export async function getBoxOfficeDailyReport(): Promise<{
  success: boolean;
  error: string | null;
  data: BoxOfficeDailyReport | null;
}> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user || !isAdminRole(user.role)) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  try {
    const now = new Date();
    const periodStart = startOfLocalDay(now);
    const periodEnd = now;

    // Տոմսի վաճառք = վճարման ավարտի պահը (ոչ ticket.createdAt՝ ամրագրում/սպասում)։
    // • Box office / scanner՝ payment-ը ստեղծվում է completed → createdAt = վաճառք
    // • Online՝ pending → completed → updatedAt = վաճառք (createdAt կարող է լինել ավելի վաղ)
    const saleCompletedToday = {
      status: 'completed' as const,
      OR: [
        { createdAt: { gte: periodStart, lte: periodEnd } },
        {
          AND: [
            { updatedAt: { gte: periodStart, lte: periodEnd } },
            { createdAt: { lt: periodStart } },
          ],
        },
      ],
      ticket: { status: { in: ['paid', 'used'] } },
    };

    const [soldPayments, refundedPayments, completedOrders, returnReceipts] =
      await Promise.all([
        prisma.payment.findMany({
          where: saleCompletedToday,
          select: {
            method: true,
            ticket: {
              select: {
                id: true,
                price: true,
                screening: {
                  select: { movie: { select: { title: true } } },
                },
              },
            },
          },
        }),
        prisma.payment.findMany({
          where: {
            status: 'refunded',
            updatedAt: { gte: periodStart, lte: periodEnd },
            ticket: { status: 'cancelled' },
          },
          select: {
            method: true,
            ticket: {
              select: {
                id: true,
                price: true,
              },
            },
          },
        }),
        prisma.order.findMany({
          where: {
            status: 'completed',
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          select: {
            id: true,
            paymentMethod: true,
            tickets: { select: { id: true } },
            orderItems: {
              select: {
                quantity: true,
                price: true,
                costPrice: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    costPrice: true,
                  },
                },
              },
            },
          },
        }),
        prisma.fiscalReceipt.findMany({
          where: {
            operation: 'return',
            status: 'printed',
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          select: {
            id: true,
            total: true,
            paymentMethod: true,
            orderId: true,
          },
        }),
      ]);

    // ── Տոմսեր (եկամուտ = ticket.price, ոչ payment.amount՝ կարող է ներառել ապրանքներ) ──
    const ticketByMovie = new Map<string, DailyReportTicketRow>();
    const ticketPayments = emptyPayment();
    let ticketRevenue = 0;
    let soldCount = 0;

    for (const payment of soldPayments) {
      const ticket = payment.ticket;
      if (!ticket) continue;
      const amount = Number(ticket.price) || 0;
      soldCount += 1;
      ticketRevenue += amount;
      addPayment(ticketPayments, payment.method ?? 'cash', amount);

      const title = ticket.screening?.movie?.title ?? 'Անհայտ ֆիլմ';
      const row = ticketByMovie.get(title);
      if (row) {
        row.count += 1;
        row.revenue += amount;
      } else {
        ticketByMovie.set(title, { movieTitle: title, count: 1, revenue: amount });
      }
    }

    let cancelledRevenue = 0;
    let cancelledCount = 0;
    const cancelledPayments = emptyPayment();
    for (const payment of refundedPayments) {
      const ticket = payment.ticket;
      if (!ticket) continue;
      const amount = Number(ticket.price) || 0;
      cancelledCount += 1;
      cancelledRevenue += amount;
      addPayment(cancelledPayments, payment.method ?? 'cash', amount);
    }

    const ticketNet = ticketRevenue - cancelledRevenue;

    // ── Ապրանքներ ────────────────────────────────────────────────────────────
    const productMap = new Map<number, DailyReportProductRow>();
    const productPayments = emptyPayment();
    let productRevenue = 0;
    let productCost = 0;
    let soldUnits = 0;
    let ordersWithProducts = 0;

    for (const order of completedOrders) {
      if (order.orderItems.length === 0) continue;
      ordersWithProducts += 1;
      const hasTicket = order.tickets.length > 0;

      for (const item of order.orderItems) {
        const qty = Math.floor(Number(item.quantity)) || 0;
        if (qty <= 0) continue;

        const unitPrice = Number(item.price) || 0;
        // Վաճառքի snapshot → եթե 0 է (հին վաճառք / չլրացված), վերցնում ենք ապրանքի ընթացիկ ինքնաարժեքը
        const snapshotCost = Number(item.costPrice) || 0;
        const catalogCost = Number(item.product.costPrice) || 0;
        const unitCost = snapshotCost > 0 ? snapshotCost : catalogCost;
        const lineRevenue = unitPrice * qty;
        const lineCost = unitCost * qty;
        const missingCost = unitCost <= 0;

        productRevenue += lineRevenue;
        productCost += lineCost;
        soldUnits += qty;
        addPayment(productPayments, order.paymentMethod, lineRevenue);

        const existing = productMap.get(item.product.id);
        if (existing) {
          existing.quantity += qty;
          existing.revenue += lineRevenue;
          existing.cost += lineCost;
          existing.profit = existing.revenue - existing.cost;
          existing.missingCost = existing.missingCost || missingCost;
          if (hasTicket) existing.withTicketQty += qty;
          else existing.productOnlyQty += qty;
        } else {
          productMap.set(item.product.id, {
            productId: item.product.id,
            name: item.product.name,
            category: item.product.category,
            quantity: qty,
            revenue: lineRevenue,
            cost: lineCost,
            profit: lineRevenue - lineCost,
            missingCost,
            withTicketQty: hasTicket ? qty : 0,
            productOnlyQty: hasTicket ? 0 : qty,
          });
        }
      }
    }

    // Վերադարձներ՝ ՀԴՄ return կտրոններ (նախորդ օրերի վաճառքների վերադարձ նույնպես)
    let returnedAmount = 0;
    const returnPayments = emptyPayment();
    for (const receipt of returnReceipts) {
      const amount = Number(receipt.total) || 0;
      returnedAmount += amount;
      addPayment(returnPayments, receipt.paymentMethod, amount);
    }

    const productNetRevenue = productRevenue - returnedAmount;
    const productNetProfit = productNetRevenue - productCost;

    const byProduct = Array.from(productMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );
    const byMovie = Array.from(ticketByMovie.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    const totalsByPayment = emptyPayment();
    for (const key of ['cash', 'card', 'other'] as const) {
      totalsByPayment[key] =
        ticketPayments[key] +
        productPayments[key] -
        cancelledPayments[key] -
        returnPayments[key];
    }

    const grossRevenue = ticketRevenue + productRevenue;
    const refunds = cancelledRevenue + returnedAmount;
    const netRevenue = grossRevenue - refunds;
    const netProfit = netRevenue - productCost;

    return {
      success: true,
      error: null,
      data: {
        generatedAt: now.toISOString(),
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        tickets: {
          soldCount,
          revenue: ticketRevenue,
          cancelledCount,
          cancelledRevenue,
          netRevenue: ticketNet,
          byMovie,
          byPayment: ticketPayments,
        },
        products: {
          soldUnits,
          orderCount: ordersWithProducts,
          revenue: productRevenue,
          cost: productCost,
          profit: productRevenue - productCost,
          returnedAmount,
          netRevenue: productNetRevenue,
          netProfit: productNetProfit,
          missingCostCount: byProduct.filter((row) => row.missingCost).length,
          byProduct,
          byPayment: productPayments,
        },
        totals: {
          grossRevenue,
          refunds,
          netRevenue,
          productCost,
          netProfit,
          byPayment: totalsByPayment,
        },
      },
    };
  } catch (error) {
    console.error('[Box Office Daily Report] Error:', error);
    return {
      success: false,
      error: 'Օրվա հաշվետվությունը բեռնելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}
