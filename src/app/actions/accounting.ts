'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import {
  defaultCostTypeForKind,
  defaultStreamForKind,
  isDeductibleCostType,
  normalizeTaxCostType,
  normalizeTaxDocumentKind,
  normalizeTaxStream,
  quarterBounds,
  quarterFilingDeadline,
  quarterLabel,
  quarterOfMonth,
  type AccountingDashboard,
  type AccountingSettingsRow,
  type AccountingWarning,
  type ProductCategoryRevenue,
  type QuarterHistoryPoint,
  type StreamTaxView,
  type TaxDocumentKind,
  type TaxDocumentRow,
} from '@/lib/accounting';
import { prisma } from '@/lib/prisma';
import { isAdminRole } from '@/lib/roles';
import {
  calcCombinedTurnoverTax,
  calcStreamTurnoverTax,
  calcTicketOperationalSplit,
  type StreamTaxResult,
} from '@/lib/turnover-tax';

const DISCLAIMER =
  'Հաշվարկը կատարվում է ՀՀ հարկային օրենսգրքի հոդ. 258-ի կանոններով՝ ՀԴՄ դասակարգման հիման վրա (տոմս 59.14 → 10%/6%/min 4.5%, ապրանք 47.x → 10%/9.5%/min 1%)։ Տոմսի հարկման բազան ամբողջ իրացման շրջանառությունն է, արտադրողի հաշիվը մասնակցում է որպես փաստաթղթավորված ծախս (նվազեցում ծախսի 6%-ի չափով), ոչ թե բազայի կիսում։ Վերջնական հայտարարագիրը պետք է հաստատի հաշվապահը/ՊԵԿ։';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isAdminRole(user.role)) {
    return null;
  }
  return user;
}

function parseDateOnly(value: string, endOfDay = false): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function roundDram(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function formatAmdText(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

function mapDocument(row: {
  id: number;
  kind: string;
  stream: string;
  costType: string;
  deductible: boolean;
  title: string;
  supplierName: string | null;
  supplierTin: string | null;
  invoiceNumber: string | null;
  amount: number;
  amountExVat: number | null;
  vatAmount: number | null;
  documentDate: Date;
  note: string | null;
  createdAt: Date;
  createdBy: { name: string | null } | null;
}): TaxDocumentRow {
  return {
    id: row.id,
    kind: row.kind,
    stream: row.stream,
    costType: row.costType,
    deductible: row.deductible,
    title: row.title,
    supplierName: row.supplierName,
    supplierTin: row.supplierTin,
    invoiceNumber: row.invoiceNumber,
    amount: Number(row.amount) || 0,
    amountExVat: row.amountExVat == null ? null : Number(row.amountExVat),
    vatAmount: row.vatAmount == null ? null : Number(row.vatAmount),
    documentDate: row.documentDate.toISOString(),
    note: row.note,
    createdByName: row.createdBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getOrCreateSettings(): Promise<AccountingSettingsRow> {
  let row = await prisma.accountingSettings.findFirst({ orderBy: { id: 'asc' } });
  if (!row) {
    row = await prisma.accountingSettings.create({
      data: {
        ticketProducerSharePercent: 50,
        annualTurnoverThresholdAmd: 115_000_000,
      },
    });
  }
  return {
    id: row.id,
    ticketProducerSharePercent: Number(row.ticketProducerSharePercent) || 50,
    annualTurnoverThresholdAmd:
      Number(row.annualTurnoverThresholdAmd) || 115_000_000,
    note: row.note,
  };
}

function toStreamView(
  result: StreamTaxResult,
  nonDeductibleCosts: number
): StreamTaxView {
  return {
    turnover: result.turnover,
    documentedCosts: result.documentedCosts,
    nonDeductibleCosts: round2(nonDeductibleCosts),
    grossTax: result.grossTax,
    deductionFromCosts: result.deductionFromCosts,
    carriedInDeduction: result.carriedInDeduction,
    availableDeduction: result.availableDeduction,
    appliedDeduction: result.appliedDeduction,
    carriedOutDeduction: result.carriedOutDeduction,
    minTax: result.minTax,
    taxDue: result.taxDue,
    effectiveRate: result.effectiveRate,
    floorApplied: result.floorApplied,
    adgCode: result.rates.adgCode,
    labelHy: result.rates.labelHy,
    activityHy: result.rates.activityHy,
    baseRate: result.rates.baseRate,
    deductionRate: result.rates.deductionRate,
    minRate: result.rates.minRate,
  };
}

interface QuarterBucket {
  year: number;
  quarter: number;
  /** Ակտիվ (չվերադարձված) տոմսերի գումարը՝ հարկման բազա */
  ticketsGross: number;
  ticketsCount: number;
  /** Այս եռամսյակում ձևակերպված վերադարձներ՝ տեղեկատվական */
  ticketRefundsProcessed: number;
  ticketRefundsCount: number;
  /** Վերադարձ, որի սկզբնական վաճառքը այլ (նախորդ) եռամսյակում է */
  retroactiveRefunds: number;
  /** Ապրանքի ակտիվ տողերը՝ հարկման բազա (վերադարձվածն արդեն հանված է) */
  productsGross: number;
  /** ՀԴՄ ապրանքային վերադարձի կտրոններ՝ տեղեկատվական */
  productReturnsProcessed: number;
  productsCost: number;
  ticketsDeductibleCosts: number;
  productsDeductibleCosts: number;
  ticketsNonDeductibleCosts: number;
  productsNonDeductibleCosts: number;
  categories: Map<string, ProductCategoryRevenue>;
}

function emptyBucket(year: number, quarter: number): QuarterBucket {
  return {
    year,
    quarter,
    ticketsGross: 0,
    ticketsCount: 0,
    ticketRefundsProcessed: 0,
    ticketRefundsCount: 0,
    retroactiveRefunds: 0,
    productsGross: 0,
    productReturnsProcessed: 0,
    productsCost: 0,
    ticketsDeductibleCosts: 0,
    productsDeductibleCosts: 0,
    ticketsNonDeductibleCosts: 0,
    productsNonDeductibleCosts: 0,
    categories: new Map(),
  };
}

function bucketId(year: number, quarter: number): string {
  return `${year}-${quarter}`;
}

export async function getAccountingDashboard(params: {
  year: number;
  quarter: number;
}): Promise<{
  success: boolean;
  error: string | null;
  data: AccountingDashboard | null;
}> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  const year = Math.floor(Number(params.year));
  const quarter = Math.floor(Number(params.quarter));
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return { success: false, error: 'Սխալ տարի', data: null };
  }
  if (!Number.isFinite(quarter) || quarter < 1 || quarter > 4) {
    return { success: false, error: 'Սխալ եռամսյակ', data: null };
  }

  try {
    const settings = await getOrCreateSettings();
    const { from: periodStart, to: periodEnd } = quarterBounds(year, quarter);

    // Չօգտագործված նվազեցումը փոխանցվում է հաջորդ ժամանակաշրջաններ, ուստի
    // հաշվարկը սկսում ենք նախորդ տարվա հունվարից և գլորում ենք եռամսյակ առ եռամսյակ։
    const windowStart = new Date(year - 1, 0, 1, 0, 0, 0, 0);

    const [
      soldPayments,
      refundedPayments,
      completedOrders,
      returnReceipts,
      taxDocs,
      fiscalSales,
      fiscalReturns,
      failedFiscalCount,
    ] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: 'completed',
          updatedAt: { gte: windowStart, lte: periodEnd },
          ticket: { status: { in: ['paid', 'used'] } },
        },
        select: { updatedAt: true, ticket: { select: { price: true } } },
      }),
      prisma.payment.findMany({
        where: {
          status: 'refunded',
          updatedAt: { gte: windowStart, lte: periodEnd },
          ticket: { status: 'cancelled' },
        },
        select: {
          createdAt: true,
          updatedAt: true,
          ticket: { select: { price: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          status: 'completed',
          createdAt: { gte: windowStart, lte: periodEnd },
        },
        select: {
          createdAt: true,
          orderItems: {
            select: {
              quantity: true,
              price: true,
              costPrice: true,
              product: { select: { category: true, costPrice: true } },
            },
          },
        },
      }),
      prisma.fiscalReceipt.findMany({
        where: {
          operation: 'return',
          status: 'printed',
          createdAt: { gte: windowStart, lte: periodEnd },
        },
        select: { createdAt: true, total: true, ticketId: true, orderId: true },
      }),
      prisma.taxDocument.findMany({
        where: { documentDate: { gte: windowStart, lte: periodEnd } },
        include: { createdBy: { select: { name: true } } },
        orderBy: [{ documentDate: 'desc' }, { id: 'desc' }],
      }),
      prisma.fiscalReceipt.aggregate({
        where: {
          operation: 'sale',
          status: 'printed',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.fiscalReceipt.aggregate({
        where: {
          operation: 'return',
          status: 'printed',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.fiscalReceipt.count({
        where: {
          status: 'failed',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
    ]);

    const buckets = new Map<string, QuarterBucket>();
    const bucketFor = (date: Date): QuarterBucket => {
      const y = date.getFullYear();
      const q = quarterOfMonth(date.getMonth());
      const key = bucketId(y, q);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = emptyBucket(y, q);
        buckets.set(key, bucket);
      }
      return bucket;
    };

    for (const payment of soldPayments) {
      const bucket = bucketFor(payment.updatedAt);
      bucket.ticketsGross += Number(payment.ticket?.price) || 0;
      bucket.ticketsCount += 1;
    }

    // Չեղարկված տոմսի payment-ը status='refunded' է դառնում, ուստի վերևի
    // հարկման բազայում այն արդեն բացակայում է — այստեղ միայն տեղեկատվություն է։
    for (const payment of refundedPayments) {
      const amount = Number(payment.ticket?.price) || 0;
      const bucket = bucketFor(payment.updatedAt);
      bucket.ticketRefundsProcessed += amount;
      bucket.ticketRefundsCount += 1;

      const soldQuarterKey = bucketId(
        payment.createdAt.getFullYear(),
        quarterOfMonth(payment.createdAt.getMonth())
      );
      const refundQuarterKey = bucketId(
        payment.updatedAt.getFullYear(),
        quarterOfMonth(payment.updatedAt.getMonth())
      );
      if (soldQuarterKey !== refundQuarterKey) {
        bucket.retroactiveRefunds += amount;
      }
    }

    for (const order of completedOrders) {
      const bucket = bucketFor(order.createdAt);
      for (const item of order.orderItems) {
        const qty = Math.floor(Number(item.quantity)) || 0;
        if (qty <= 0) continue;
        const unitPrice = Number(item.price) || 0;
        const snapshotCost = Number(item.costPrice) || 0;
        const catalogCost = Number(item.product.costPrice) || 0;
        const unitCost = snapshotCost > 0 ? snapshotCost : catalogCost;
        const lineRevenue = unitPrice * qty;
        const lineCost = unitCost * qty;

        bucket.productsGross += lineRevenue;
        bucket.productsCost += lineCost;

        const cat = item.product.category || 'other';
        const existing = bucket.categories.get(cat);
        if (existing) {
          existing.revenue += lineRevenue;
          existing.cost += lineCost;
          existing.quantity += qty;
        } else {
          bucket.categories.set(cat, {
            category: cat,
            revenue: lineRevenue,
            cost: lineCost,
            quantity: qty,
          });
        }
      }
    }

    // ՀԴՄ վերադարձի կտրոններ։ ticketId-ով՝ տոմսի չեղարկում (արդեն հաշվված
    // payment.refunded-ով), առանց ticketId-ի՝ ապրանքի վերադարձ։
    // Ապրանքի վերադարձը ջնջում է orderItem-ը, ուստի բազան արդեն զուտ է —
    // այս գումարները միայն ցուցադրման/ստուգման համար են։
    for (const receipt of returnReceipts) {
      const amount = Number(receipt.total) || 0;
      if (receipt.ticketId) continue;
      bucketFor(receipt.createdAt).productReturnsProcessed += amount;
    }

    for (const doc of taxDocs) {
      const bucket = bucketFor(doc.documentDate);
      const amount = Number(doc.amount) || 0;
      const isProducts = doc.stream === 'products';
      const deductible = doc.deductible && isDeductibleCostType(doc.costType);
      if (deductible) {
        if (isProducts) bucket.productsDeductibleCosts += amount;
        else bucket.ticketsDeductibleCosts += amount;
      } else {
        if (isProducts) bucket.productsNonDeductibleCosts += amount;
        else bucket.ticketsNonDeductibleCosts += amount;
      }
    }

    // Եռամսյակ առ եռամսյակ գլորում՝ չօգտագործված նվազեցման փոխանցումով
    const orderedQuarters: Array<{ year: number; quarter: number }> = [];
    for (let y = year - 1; y <= year; y++) {
      for (let q = 1; q <= 4; q++) {
        if (y === year && q > quarter) break;
        orderedQuarters.push({ year: y, quarter: q });
      }
    }

    let ticketsCarry = 0;
    let productsCarry = 0;
    const history: QuarterHistoryPoint[] = [];
    let selectedTickets: StreamTaxResult | null = null;
    let selectedProducts: StreamTaxResult | null = null;
    let selectedBucket = emptyBucket(year, quarter);
    let ytdTurnover = 0;
    let ytdTaxEstimate = 0;

    for (const q of orderedQuarters) {
      const bucket =
        buckets.get(bucketId(q.year, q.quarter)) ??
        emptyBucket(q.year, q.quarter);
      // Բազան արդեն զուտ է՝ վերադարձված տոմսերն ու ապրանքները դուրս են մնում
      // համապատասխանաբար payment.status-ից և orderItem-ի ջնջումից։
      const ticketsTurnover = Math.max(0, round2(bucket.ticketsGross));
      const productsTurnover = Math.max(0, round2(bucket.productsGross));

      const ticketsResult = calcStreamTurnoverTax('tickets', {
        turnover: ticketsTurnover,
        documentedCosts: bucket.ticketsDeductibleCosts,
        carriedInDeduction: ticketsCarry,
      });
      const productsResult = calcStreamTurnoverTax('products', {
        turnover: productsTurnover,
        documentedCosts: bucket.productsDeductibleCosts,
        carriedInDeduction: productsCarry,
      });

      ticketsCarry = ticketsResult.carriedOutDeduction;
      productsCarry = productsResult.carriedOutDeduction;

      history.push({
        year: q.year,
        quarter: q.quarter,
        label: quarterLabel(q.year, q.quarter),
        ticketsTurnover,
        productsTurnover,
        taxDue: roundDram(ticketsResult.taxDue + productsResult.taxDue),
      });

      if (q.year === year) {
        ytdTurnover = round2(ytdTurnover + ticketsTurnover + productsTurnover);
        ytdTaxEstimate = roundDram(
          ytdTaxEstimate + ticketsResult.taxDue + productsResult.taxDue
        );
      }

      if (q.year === year && q.quarter === quarter) {
        selectedTickets = ticketsResult;
        selectedProducts = productsResult;
        selectedBucket = bucket;
      }
    }

    if (!selectedTickets || !selectedProducts) {
      return { success: false, error: 'Հաշվարկը ձախողվեց', data: null };
    }

    const combined = calcCombinedTurnoverTax({
      tickets: {
        turnover: selectedTickets.turnover,
        documentedCosts: selectedTickets.documentedCosts,
        carriedInDeduction: selectedTickets.carriedInDeduction,
      },
      products: {
        turnover: selectedProducts.turnover,
        documentedCosts: selectedProducts.documentedCosts,
        carriedInDeduction: selectedProducts.carriedInDeduction,
      },
    });

    const ticketsNet = selectedTickets.turnover;
    const productsNet = selectedProducts.turnover;
    const productsCost = round2(selectedBucket.productsCost);
    const productsProfit = round2(productsNet - productsCost);

    const split = calcTicketOperationalSplit(
      ticketsNet,
      settings.ticketProducerSharePercent
    );
    const estimatedOperatingProfit = round2(split.cinemaKeep + productsProfit);

    const fiscalSalesTotal = round2(Number(fiscalSales._sum.total) || 0);
    const fiscalReturnsTotal = round2(Number(fiscalReturns._sum.total) || 0);
    const fiscalNet = round2(fiscalSalesTotal - fiscalReturnsTotal);
    const accountingTurnover = combined.totalTurnover;
    const fiscalDifference = round2(fiscalNet - accountingTurnover);

    const periodDocs = taxDocs.filter(
      (d) => d.documentDate >= periodStart && d.documentDate <= periodEnd
    );
    const nonDeductibleTotal = round2(
      selectedBucket.ticketsNonDeductibleCosts +
        selectedBucket.productsNonDeductibleCosts
    );

    const now = new Date();
    const isClosed = periodEnd < now;
    const threshold = settings.annualTurnoverThresholdAmd;
    const remaining = round2(Math.max(0, threshold - ytdTurnover));
    const percentUsed =
      threshold > 0 ? Math.min(100, (ytdTurnover / threshold) * 100) : 0;

    const warnings: AccountingWarning[] = [];

    if (!isClosed) {
      warnings.push({
        level: 'info',
        message:
          'Եռամսյակը դեռ ընթացքի մեջ է — թվերը կփոխվեն մինչև ժամանակաշրջանի ավարտը։',
      });
    }
    if (failedFiscalCount > 0) {
      warnings.push({
        level: 'error',
        message: `${failedFiscalCount} ֆիսկալ կտրոն չի տպվել (status=failed)։ Չֆիսկալացված վաճառքը հարկային ռիսկ է — ստուգեք /admin/fiscal-ում։`,
      });
    }
    if (Math.abs(fiscalDifference) > Math.max(1000, accountingTurnover * 0.01)) {
      warnings.push({
        level: 'warning',
        message: `ՀԴՄ զուտ գումարը և հաշվառման շրջանառությունը տարբերվում են ${formatAmdText(Math.abs(fiscalDifference))}-ով։ Ստուգեք չտպված կտրոնները և ժամանակային շեղումները։`,
      });
    }
    if (selectedBucket.retroactiveRefunds > 0) {
      warnings.push({
        level: 'warning',
        message: `${formatAmdText(selectedBucket.retroactiveRefunds)} վերադարձ վերաբերում է ավելի վաղ եռամսյակի վաճառքի։ Ծրագիրը այն հանում է վաճառքի եռամսյակի բազայից — եթե այդ եռամսյակի հայտարարագիրն արդեն ներկայացված է, կարող է անհրաժեշտ լինել ճշտված հաշվարկ։`,
      });
    }
    if (nonDeductibleTotal > 0) {
      warnings.push({
        level: 'info',
        message: `${formatAmdText(nonDeductibleTotal)} ծախս նշված է որպես չնվազեցվող (հոդ. 258 մաս 6՝ հիմնական միջոց, կապիտալ ծախս, գործուղում, ներկայացուցչական և այլն)։`,
      });
    }
    if (combined.totalCarriedOutDeduction > 0) {
      warnings.push({
        level: 'info',
        message: `${formatAmdText(combined.totalCarriedOutDeduction)} չօգտագործված նվազեցում փոխանցվում է հաջորդ եռամսյակ (նույն գործունեության շրջանակում)։`,
      });
    }
    if (percentUsed >= 100) {
      warnings.push({
        level: 'error',
        message:
          '115 մլն ֏ շեմը գերազանցվել է։ Հոդ. 254–255՝ շրջհարկ վճարողի կարգավիճակը դադարում է գերազանցման պահից, և 20 օրվա ընթացքում պետք է հայտարարություն ներկայացվի ՊԵԿ։',
      });
    } else if (percentUsed >= 85) {
      warnings.push({
        level: 'error',
        message: `Տարեկան շրջանառությունը հասել է շեմի ${percentUsed.toFixed(1)}%-ին (${formatAmdText(ytdTurnover)})։ Գերազանցման պահից կարգավիճակը դադարում է՝ նախապատրաստեք ԱԱՀ/ընդհանուր համակարգի անցումը։`,
      });
    } else if (percentUsed >= 70) {
      warnings.push({
        level: 'warning',
        message: `Տարեկան շրջանառությունը՝ շեմի ${percentUsed.toFixed(1)}%-ը (${formatAmdText(ytdTurnover)} / ${formatAmdText(threshold)})։`,
      });
    }
    if (selectedProducts.turnover > 0 && selectedProducts.documentedCosts === 0) {
      warnings.push({
        level: 'warning',
        message:
          'Ապրանքների վաճառք կա, բայց գնումների հաշիվներ դեռ չեն բեռնվել։ Առանց դրանց շրջհարկը հաշվվում է ամբողջ գումարից (10%), իսկ գնումների ծախսը կարող է նվազեցնել հարկը մինչև ~1%։ ՊԵԿ-ից ներբեռնեք «Ստացված հարկային հաշիվներ» Excel-ը և գցեք վերևի բեռնման դաշտում։',
      });
    }
    if (selectedTickets.turnover > 0 && selectedTickets.documentedCosts === 0) {
      warnings.push({
        level: 'warning',
        message:
          'Տոմսերի վաճառք կա, բայց ֆիլմ արտադրողի հաշիվներ դեռ չեն բեռնվել։ Առանց դրանց շրջհարկը հաշվվում է տոմսերի ամբողջ գումարից (10%), իսկ արտադրողին վճարած գումարը կարող է նվազեցնել հարկը մինչև ~4.5%։ ՊԵԿ-ից ներբեռնեք «Ստացված հաշիվ վավերագրեր» Excel-ը և գցեք վերևի բեռնման դաշտում։',
      });
    }
    if (selectedBucket.productsGross > 0 && productsCost <= 0) {
      warnings.push({
        level: 'info',
        message:
          'Ապրանքների ինքնաարժեքը 0 է — գործնական շահույթը ճիշտ չի հաշվվի (հարկի վրա չի ազդում)։',
      });
    }
    if (
      selectedBucket.categories.has('popcorn') ||
      selectedBucket.categories.has('hot_dog') ||
      selectedBucket.categories.has('nachos') ||
      selectedBucket.categories.has('coffee')
    ) {
      warnings.push({
        level: 'info',
        message:
          'Տեղում պատրաստվող ապրանքը (պոպկորն, տաք ուտելիք, սուրճ) ՊԵԿ-ը կարող է դասակարգել «հանրային սննդի» գործունեություն՝ 12% / 9% / min 3.5%։ Այս հաշվարկը հետևում է ՀԴՄ գրանցված դասակարգմանը (47.x՝ առևտուր) — հաստատեք հաշվապահի հետ։',
      });
    }

    const data: AccountingDashboard = {
      period: {
        year,
        quarter,
        label: quarterLabel(year, quarter),
        from: periodStart.toISOString(),
        to: periodEnd.toISOString(),
        filingDeadline: quarterFilingDeadline(year, quarter).toISOString(),
        isClosed,
      },
      settings,
      revenue: {
        ticketsNet,
        ticketsCount: selectedBucket.ticketsCount,
        ticketRefundsProcessed: round2(selectedBucket.ticketRefundsProcessed),
        ticketRefundsCount: selectedBucket.ticketRefundsCount,
        productsNet,
        productReturnsProcessed: round2(
          selectedBucket.productReturnsProcessed
        ),
        productsCost,
        productsProfit,
        byProductCategory: Array.from(selectedBucket.categories.values())
          .map((r) => ({
            ...r,
            revenue: round2(r.revenue),
            cost: round2(r.cost),
          }))
          .sort((a, b) => b.revenue - a.revenue),
      },
      fiscal: {
        salesTotal: fiscalSalesTotal,
        returnsTotal: fiscalReturnsTotal,
        salesCount: fiscalSales._count._all,
        returnsCount: fiscalReturns._count._all,
        netTotal: fiscalNet,
        failedCount: failedFiscalCount,
        retroactiveRefunds: round2(selectedBucket.retroactiveRefunds),
        difference: fiscalDifference,
      },
      yearToDate: {
        turnover: ytdTurnover,
        threshold,
        remaining,
        percentUsed: round2(percentUsed),
        taxPaidEstimate: ytdTaxEstimate,
      },
      documents: {
        ticketsCosts: round2(selectedBucket.ticketsDeductibleCosts),
        productsCosts: round2(selectedBucket.productsDeductibleCosts),
        nonDeductibleTotal,
        rows: periodDocs.map(mapDocument),
      },
      operational: {
        producerSharePercent: split.sharePercent,
        producerShareAmount: split.producerShare,
        cinemaTicketKeep: split.cinemaKeep,
        estimatedOperatingProfit,
      },
      tax: {
        tickets: toStreamView(
          selectedTickets,
          selectedBucket.ticketsNonDeductibleCosts
        ),
        products: toStreamView(
          selectedProducts,
          selectedBucket.productsNonDeductibleCosts
        ),
        totalTurnover: combined.totalTurnover,
        totalDocumentedCosts: combined.totalDocumentedCosts,
        totalTaxDue: combined.totalTaxDue,
        totalCarriedOutDeduction: combined.totalCarriedOutDeduction,
      },
      history: history.filter((h) => h.year === year || h.taxDue > 0),
      warnings,
      disclaimer: DISCLAIMER,
    };

    return { success: true, error: null, data };
  } catch (err) {
    console.error('[getAccountingDashboard]', err);
    return { success: false, error: 'Հաշվարկը ձախողվեց', data: null };
  }
}

export async function getAccountingSettings(): Promise<{
  success: boolean;
  error: string | null;
  data: AccountingSettingsRow | null;
}> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }
  try {
    const data = await getOrCreateSettings();
    return { success: true, error: null, data };
  } catch (err) {
    console.error('[getAccountingSettings]', err);
    return { success: false, error: 'Սխալ', data: null };
  }
}

export async function updateAccountingSettings(input: {
  ticketProducerSharePercent: number;
  annualTurnoverThresholdAmd?: number;
  note?: string | null;
}): Promise<{ success: boolean; error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const share = Number(input.ticketProducerSharePercent);
  if (!Number.isFinite(share) || share < 0 || share > 100) {
    return { success: false, error: 'Արտադրողի մասը պետք է լինի 0–100%' };
  }

  try {
    const current = await getOrCreateSettings();
    await prisma.accountingSettings.update({
      where: { id: current.id },
      data: {
        ticketProducerSharePercent: share,
        annualTurnoverThresholdAmd:
          input.annualTurnoverThresholdAmd != null &&
          Number.isFinite(input.annualTurnoverThresholdAmd) &&
          input.annualTurnoverThresholdAmd > 0
            ? input.annualTurnoverThresholdAmd
            : current.annualTurnoverThresholdAmd,
        note: input.note?.trim() || null,
      },
    });
    revalidatePath('/admin/accounting');
    return { success: true, error: null };
  } catch (err) {
    console.error('[updateAccountingSettings]', err);
    return { success: false, error: 'Պահպանումը ձախողվեց' };
  }
}

interface TaxDocumentInput {
  kind: string;
  stream?: string;
  costType?: string;
  deductible?: boolean;
  title: string;
  supplierName?: string;
  supplierTin?: string;
  invoiceNumber?: string;
  amount: number;
  documentDate: string;
  note?: string;
}

function normalizeDocInput(input: TaxDocumentInput) {
  const kind = normalizeTaxDocumentKind(input.kind) as TaxDocumentKind;
  const costType = input.costType
    ? normalizeTaxCostType(input.costType)
    : defaultCostTypeForKind(kind);

  // producer → միշտ տոմսային հոսք (59.14), purchase → միշտ ապրանքային (47.x)
  const stream =
    kind === 'producer'
      ? 'tickets'
      : kind === 'purchase'
        ? 'products'
        : input.stream != null
          ? normalizeTaxStream(input.stream)
          : defaultStreamForKind(kind);

  const deductible =
    input.deductible === false ? false : isDeductibleCostType(costType);

  return { kind, costType, stream, deductible };
}

export async function createTaxDocument(
  input: TaxDocumentInput
): Promise<{ success: boolean; error: string | null; id?: number }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const title = String(input.title ?? '').trim();
  const amount = Number(input.amount);
  const documentDate = parseDateOnly(input.documentDate);

  if (!title) return { success: false, error: 'Վերնագիրը պարտադիր է' };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'Գումարը սխալ է' };
  }
  if (!documentDate) return { success: false, error: 'Ամսաթիվը սխալ է' };

  const { kind, costType, stream, deductible } = normalizeDocInput(input);

  try {
    const created = await prisma.taxDocument.create({
      data: {
        kind,
        stream,
        costType,
        deductible,
        title,
        supplierName: input.supplierName?.trim() || null,
        supplierTin: input.supplierTin?.trim() || null,
        invoiceNumber: input.invoiceNumber?.trim() || null,
        amount,
        documentDate,
        note: input.note?.trim() || null,
        createdById: Number(admin.id) || null,
      },
    });
    revalidatePath('/admin/accounting');
    return { success: true, error: null, id: created.id };
  } catch (err) {
    console.error('[createTaxDocument]', err);
    return { success: false, error: 'Ստեղծումը ձախողվեց' };
  }
}

export async function updateTaxDocument(
  input: TaxDocumentInput & { id: number }
): Promise<{ success: boolean; error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const id = Number(input.id);
  if (!Number.isFinite(id) || id <= 0) {
    return { success: false, error: 'Սխալ ID' };
  }

  const title = String(input.title ?? '').trim();
  const amount = Number(input.amount);
  const documentDate = parseDateOnly(input.documentDate);

  if (!title) return { success: false, error: 'Վերնագիրը պարտադիր է' };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'Գումարը սխալ է' };
  }
  if (!documentDate) return { success: false, error: 'Ամսաթիվը սխալ է' };

  const { kind, costType, stream, deductible } = normalizeDocInput(input);

  try {
    await prisma.taxDocument.update({
      where: { id },
      data: {
        kind,
        stream,
        costType,
        deductible,
        title,
        supplierName: input.supplierName?.trim() || null,
        supplierTin: input.supplierTin?.trim() || null,
        invoiceNumber: input.invoiceNumber?.trim() || null,
        amount,
        documentDate,
        note: input.note?.trim() || null,
      },
    });
    revalidatePath('/admin/accounting');
    return { success: true, error: null };
  } catch (err) {
    console.error('[updateTaxDocument]', err);
    return { success: false, error: 'Թարմացումը ձախողվեց' };
  }
}

export async function setTaxDocumentDeductible(input: {
  id: number;
  deductible: boolean;
}): Promise<{ success: boolean; error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }
  const id = Number(input.id);
  if (!Number.isFinite(id) || id <= 0) {
    return { success: false, error: 'Սխալ ID' };
  }
  try {
    await prisma.taxDocument.update({
      where: { id },
      data: { deductible: Boolean(input.deductible) },
    });
    revalidatePath('/admin/accounting');
    return { success: true, error: null };
  } catch (err) {
    console.error('[setTaxDocumentDeductible]', err);
    return { success: false, error: 'Թարմացումը ձախողվեց' };
  }
}

export async function deleteTaxDocument(
  id: number
): Promise<{ success: boolean; error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const docId = Number(id);
  if (!Number.isFinite(docId) || docId <= 0) {
    return { success: false, error: 'Սխալ ID' };
  }

  try {
    await prisma.taxDocument.delete({ where: { id: docId } });
    revalidatePath('/admin/accounting');
    return { success: true, error: null };
  } catch (err) {
    console.error('[deleteTaxDocument]', err);
    return { success: false, error: 'Ջնջումը ձախողվեց' };
  }
}

export async function importTaxDocumentsFromXlsx(formData: FormData): Promise<{
  success: boolean;
  error: string | null;
  created: number;
  skippedExisting: number;
  skippedRows: number;
  fileKind: string | null;
  totalAmount: number;
  warnings: string[];
}> {
  const empty = {
    created: 0,
    skippedExisting: 0,
    skippedRows: 0,
    fileKind: null,
    totalAmount: 0,
    warnings: [] as string[],
  };

  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', ...empty };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Ֆայլը բացակայում է', ...empty };
  }

  const kindRaw = String(formData.get('kind') ?? 'auto');
  const kindOverride =
    kindRaw === 'purchase' || kindRaw === 'producer' ? kindRaw : undefined;

  try {
    const XLSX = await import('xlsx');
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, error: 'Excel-ում թերթ չկա', ...empty };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
    }) as unknown[][];

    const { parseSrcInvoiceRows } = await import('@/lib/src-invoice-import');
    const parsed = parseSrcInvoiceRows(rows, kindOverride);

    if (parsed.fileKind === 'unknown' || parsed.invoices.length === 0) {
      return {
        success: false,
        error:
          parsed.warnings[0] ||
          'Ֆայլում հաշիվ չգտնվեց։ Ստուգեք որ սա ՊԵԿ «Ստացված հարկային հաշիվներ» կամ «Ստացված հաշիվ վավերագրեր» export է։',
        ...empty,
        skippedRows: parsed.skippedRows,
        fileKind: parsed.fileKind,
        warnings: parsed.warnings,
      };
    }

    const invoiceNumbers = parsed.invoices.map((i) => i.invoiceNumber);
    const existing = await prisma.taxDocument.findMany({
      where: { invoiceNumber: { in: invoiceNumbers } },
      select: { invoiceNumber: true },
    });
    const existingSet = new Set(
      existing.map((e) => e.invoiceNumber).filter(Boolean) as string[]
    );

    let created = 0;
    let skippedExisting = 0;
    let totalAmount = 0;
    const createdById = Number(admin.id) || null;

    for (const inv of parsed.invoices) {
      if (existingSet.has(inv.invoiceNumber)) {
        skippedExisting += 1;
        continue;
      }
      const documentDate = parseDateOnly(inv.documentDate);
      if (!documentDate) {
        skippedExisting += 1;
        continue;
      }

      await prisma.taxDocument.create({
        data: {
          kind: inv.kind,
          stream: inv.stream,
          costType: inv.costType,
          deductible: isDeductibleCostType(inv.costType),
          title: inv.title,
          supplierName: inv.supplierName,
          supplierTin: inv.supplierTin,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          amountExVat: inv.amountExVat,
          vatAmount: inv.vatAmount,
          documentDate,
          note: inv.note,
          createdById,
        },
      });
      existingSet.add(inv.invoiceNumber);
      created += 1;
      totalAmount += inv.amount;
    }

    revalidatePath('/admin/accounting');
    return {
      success: true,
      error: null,
      created,
      skippedExisting,
      skippedRows: parsed.skippedRows,
      fileKind: parsed.fileKind,
      totalAmount: round2(totalAmount),
      warnings: parsed.warnings,
    };
  } catch (err) {
    console.error('[importTaxDocumentsFromXlsx]', err);
    return { success: false, error: 'Excel ներմուծումը ձախողվեց', ...empty };
  }
}
