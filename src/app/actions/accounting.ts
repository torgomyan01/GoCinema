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
import { getCbaAmdRate, convertToAmd } from '@/lib/cba-rates';
import {
  META_ADS_SUPPLIER_NAME,
  META_ADS_SUPPLIER_TIN,
  parseMetaAdsInvoiceCsv,
  metaInvoiceNumber,
  type MetaAdsImportPreview,
  type MetaAdsImportPreviewItem,
} from '@/lib/meta-ads-csv';
import { prisma } from '@/lib/prisma';
import { revokeBonusForOrder, revokeBonusForTicket } from '@/lib/bonus';
import { returnOrderItemStock } from '@/lib/product-units';
import { isAdminRole } from '@/lib/roles';
import {
  allocatePekCosts,
  buildPekXml,
  pekCostBucket,
  pekXmlFilename,
} from '@/lib/pek-xml';
import {
  EXPENSE_CATEGORIES,
  expenseCategoryHint,
  expenseCategoryLabel,
  expenseReducesTurnoverTax,
} from '@/lib/expenses';
import {
  calcCombinedTurnoverTax,
  calcStreamTurnoverTax,
  calcTicketOperationalSplit,
  type StreamTaxResult,
} from '@/lib/turnover-tax';

const DISCLAIMER =
  'Հարկման բազան ընտրված եռամսյակում տպված ՀԴՄ կտրոններն են (վաճառք − վերադարձ)։ Հաշվարկը կատարվում է ՀՀ հարկային օրենսգրքի հոդ. 258-ի կանոններով (տոմս 59.14 → 10%/6%/min 4.5%, ապրանք 47.x → 10%/9.5%/min 1%)։ Արտադրողի հաշիվը մասնակցում է որպես փաստաթղթավորված ծախս, ոչ թե բազայի կիսում։ Վերջնական հայտարարագիրը պետք է հաստատի հաշվապահը/ՊԵԿ։';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isAdminRole(user.role)) {
    return null;
  }
  return user;
}

function parseDateOnly(value: string, endOfDay = false): Date | null {
  const iso = String(value ?? '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }
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

function receiptPrintedAt(row: {
  fiscalTime: Date | null;
  createdAt: Date;
}): Date {
  return row.fiscalTime ?? row.createdAt;
}

function extractPayloadItems(payload: unknown): Array<{
  productCode?: unknown;
  productName?: unknown;
  name?: unknown;
  price?: unknown;
  qty?: unknown;
  dep?: unknown;
  isTicket?: unknown;
}> {
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  const raw = obj.items ?? obj.lines;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => item && typeof item === 'object') as Array<{
    productCode?: unknown;
    productName?: unknown;
    name?: unknown;
    price?: unknown;
    qty?: unknown;
    dep?: unknown;
    isTicket?: unknown;
  }>;
}

function isTicketPayloadItem(item: {
  productCode?: unknown;
  productName?: unknown;
  name?: unknown;
  dep?: unknown;
  isTicket?: unknown;
}): boolean {
  if (item.isTicket === true) return true;
  const code = String(item.productCode ?? '')
    .trim()
    .toUpperCase();
  if (code === 'TICKET') return true;
  if (Number(item.dep) === 1) return true;
  const name = String(item.productName ?? item.name ?? '');
  return name.startsWith('Տոմս');
}

function inferProductCategory(name: string): string {
  const n = name.toLowerCase();
  if (/պոպկորն|popcorn/.test(n)) return 'popcorn';
  if (/հոթ.?դոգ|hot.?dog/.test(n)) return 'hot_dog';
  if (/նաչոս|nachos/.test(n)) return 'nachos';
  if (/սուրճ|coffee|espresso|cappuccino|latte/.test(n)) return 'coffee';
  if (/սառը թեյ|iced\s*tea/.test(n)) return 'iced_tea';
  if (/cola|fanta|sprite|գազավոր/.test(n)) return 'soda';
  if (/հյութ|juice/.test(n)) return 'juice';
  if (/ջուր|water/.test(n)) return 'water';
  if (/թեյ|tea/.test(n)) return 'tea';
  if (/շոկոլադ|chocolate/.test(n)) return 'chocolate';
  if (/պաղպաղակ|ice\s*cream/.test(n)) return 'ice_cream';
  return 'other';
}

function addCategoryRevenue(
  categories: Map<string, ProductCategoryRevenue>,
  category: string,
  revenue: number,
  quantity: number
) {
  const existing = categories.get(category);
  if (existing) {
    existing.revenue += revenue;
    existing.quantity += quantity;
  } else {
    categories.set(category, {
      category,
      revenue,
      cost: 0,
      quantity,
    });
  }
}

function splitFiscalAmount(row: {
  total: number;
  ticketId: number | null;
  orderId: number | null;
  requestPayload: unknown;
}): { tickets: number; products: number; ticketLines: number } {
  const total = Number(row.total) || 0;
  const items = extractPayloadItems(row.requestPayload);
  if (items.length > 0) {
    let tickets = 0;
    let products = 0;
    let ticketLines = 0;
    for (const item of items) {
      const qty = Number(item.qty);
      const lineQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const line = (Number(item.price) || 0) * lineQty;
      if (isTicketPayloadItem(item)) {
        tickets += line;
        ticketLines += lineQty;
      } else {
        products += line;
      }
    }
    return {
      tickets: round2(tickets),
      products: round2(products),
      ticketLines,
    };
  }
  if (row.ticketId != null) {
    return { tickets: round2(total), products: 0, ticketLines: 1 };
  }
  return { tickets: 0, products: round2(total), ticketLines: 0 };
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
  /** ՀԴՄ տպված տոմսերի զուտ (վաճառք − վերադարձ) */
  ticketsGross: number;
  ticketsCount: number;
  ticketRefundsProcessed: number;
  ticketRefundsCount: number;
  /** ՀԴՄ տպված ապրանքների զուտ (վաճառք − վերադարձ) */
  productsGross: number;
  productReturnsProcessed: number;
  productsCost: number;
  ticketsDeductibleCosts: number;
  productsDeductibleCosts: number;
  ticketsNonDeductibleCosts: number;
  productsNonDeductibleCosts: number;
  goodsCosts: number;
  directOtherCosts: number;
  sharedSellingAdmin: number;
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
    productsGross: 0,
    productReturnsProcessed: 0,
    productsCost: 0,
    ticketsDeductibleCosts: 0,
    productsDeductibleCosts: 0,
    ticketsNonDeductibleCosts: 0,
    productsNonDeductibleCosts: 0,
    goodsCosts: 0,
    directOtherCosts: 0,
    sharedSellingAdmin: 0,
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

    const [printedReceipts, taxDocs, failedFiscalCount, periodExpenses] =
      await Promise.all([
      prisma.fiscalReceipt.findMany({
        where: {
          status: 'printed',
          OR: [
            { createdAt: { gte: windowStart, lte: periodEnd } },
            { fiscalTime: { gte: windowStart, lte: periodEnd } },
          ],
        },
        select: {
          operation: true,
          total: true,
          ticketId: true,
          orderId: true,
          createdAt: true,
          fiscalTime: true,
          requestPayload: true,
        },
      }),
      prisma.taxDocument.findMany({
        where: { documentDate: { gte: windowStart, lte: periodEnd } },
        include: { createdBy: { select: { name: true } } },
        orderBy: [{ documentDate: 'desc' }, { id: 'desc' }],
      }),
      prisma.fiscalReceipt.count({
        where: {
          status: 'failed',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
      prisma.expense.findMany({
        where: { expenseDate: { gte: periodStart, lte: periodEnd } },
        select: { category: true, amount: true },
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

    let fiscalSalesTotal = 0;
    let fiscalReturnsTotal = 0;
    let fiscalSalesCount = 0;
    let fiscalReturnsCount = 0;

    for (const receipt of printedReceipts) {
      const printedAt = receiptPrintedAt(receipt);
      if (printedAt < windowStart || printedAt > periodEnd) continue;
      const bucket = bucketFor(printedAt);
      const split = splitFiscalAmount(receipt);
      const isSale = receipt.operation !== 'return';
      const sign = isSale ? 1 : -1;
      if (isSale) {
        bucket.ticketsGross += split.tickets;
        bucket.ticketsCount += split.ticketLines;
        bucket.productsGross += split.products;
      } else {
        bucket.ticketsGross -= split.tickets;
        bucket.ticketRefundsProcessed += split.tickets;
        bucket.ticketRefundsCount += split.ticketLines;
        bucket.productsGross -= split.products;
        bucket.productReturnsProcessed += split.products;
      }

      const items = extractPayloadItems(receipt.requestPayload);
      for (const item of items) {
        if (isTicketPayloadItem(item)) continue;
        const qty = Number(item.qty);
        const lineQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
        const line = (Number(item.price) || 0) * lineQty;
        const name = String(item.productName ?? item.name ?? '').trim();
        addCategoryRevenue(
          bucket.categories,
          inferProductCategory(name),
          sign * line,
          sign * lineQty
        );
      }

      if (printedAt >= periodStart && printedAt <= periodEnd) {
        const amount = Number(receipt.total) || 0;
        if (isSale) {
          fiscalSalesTotal += amount;
          fiscalSalesCount += 1;
        } else {
          fiscalReturnsTotal += amount;
          fiscalReturnsCount += 1;
        }
      }
    }
    fiscalSalesTotal = round2(fiscalSalesTotal);
    fiscalReturnsTotal = round2(fiscalReturnsTotal);

    for (const doc of taxDocs) {
      const bucket = bucketFor(doc.documentDate);
      const amount = Number(doc.amount) || 0;
      const isProducts = doc.stream === 'products';
      const deductible = doc.deductible && isDeductibleCostType(doc.costType);
      if (!deductible) {
        if (isProducts) bucket.productsNonDeductibleCosts += amount;
        else bucket.ticketsNonDeductibleCosts += amount;
        continue;
      }
      const kind = pekCostBucket(doc.costType, true);
      if (kind === 'goods') bucket.goodsCosts += amount;
      else if (kind === 'directOther') bucket.directOtherCosts += amount;
      else bucket.sharedSellingAdmin += amount;
    }

    for (const bucket of buckets.values()) {
      const allocated = allocatePekCosts({
        ticketsTurnover: Math.max(0, bucket.ticketsGross),
        productsTurnover: Math.max(0, bucket.productsGross),
        goodsCost: bucket.goodsCosts,
        directOtherCost: bucket.directOtherCosts,
        sharedSellingAdmin: bucket.sharedSellingAdmin,
      });
      bucket.ticketsDeductibleCosts = allocated.ticketsDocumented;
      bucket.productsDeductibleCosts = allocated.productsDocumented;
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
      // Հարկման բազան տպված ՀԴՄ կտրոնների զուտն է (վաճառք − վերադարձ)։
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

    const expenseMap = new Map<
      string,
      { category: string; amount: number; count: number }
    >();
    for (const row of periodExpenses) {
      const category = row.category || 'other';
      const amount = Number(row.amount) || 0;
      const existing = expenseMap.get(category);
      if (existing) {
        existing.amount += amount;
        existing.count += 1;
      } else {
        expenseMap.set(category, { category, amount, count: 1 });
      }
    }
    const knownCategories = new Set<string>(EXPENSE_CATEGORIES);
    const expensesByCategory = [
      ...EXPENSE_CATEGORIES.map((category) => {
        const row = expenseMap.get(category);
        return {
          category,
          label: expenseCategoryLabel(category),
          hint: expenseCategoryHint(category),
          amount: round2(row?.amount ?? 0),
          count: row?.count ?? 0,
          reducesTurnoverTax: expenseReducesTurnoverTax(category),
        };
      }),
      ...Array.from(expenseMap.values())
        .filter((row) => !knownCategories.has(row.category))
        .map((row) => ({
          category: row.category,
          label: expenseCategoryLabel(row.category),
          hint: expenseCategoryHint(row.category),
          amount: round2(row.amount),
          count: row.count,
          reducesTurnoverTax: expenseReducesTurnoverTax(row.category),
        })),
    ];
    const operatingExpensesTotal = round2(
      expensesByCategory.reduce((sum, row) => sum + row.amount, 0)
    );
    const statutoryPaymentsTotal = round2(
      expensesByCategory
        .filter((row) =>
          ['stamp_duty', 'state_duty', 'income_tax'].includes(row.category)
        )
        .reduce((sum, row) => sum + row.amount, 0)
    );
    const estimatedOperatingProfit = round2(
      split.cinemaKeep + productsProfit - operatingExpensesTotal
    );

    const fiscalNet = round2(fiscalSalesTotal - fiscalReturnsTotal);

    const periodDocs = taxDocs.filter(
      (d) => d.documentDate >= periodStart && d.documentDate <= periodEnd
    );
    const periodMarketingDocs = periodDocs.filter(
      (d) => d.costType === 'marketing'
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
    if (operatingExpensesTotal === 0) {
      warnings.push({
        level: 'info',
        message:
          'Այս եռամսյակում գործնական ծախսեր չկան (վարձ, աշխատավարձ, դրոշմանիշային վճար և այլն)։ Գրանցեք /admin/expenses էջում — դրանք կհանվեն գործնական շահույթից։ Դրոշմանիշային վճարը և պետական տուրքը շրջհարկը չեն նվազեցնում։',
      });
    } else if (statutoryPaymentsTotal > 0) {
      warnings.push({
        level: 'info',
        message: `${formatAmdText(statutoryPaymentsTotal)} դրոշմանիշային վճար / պետական տուրք / եկամտային հարկ հաշվված է որպես գործնական ծախս, բայց շրջհարկի նվազեցման բանաձևում չի մասնակցում։`,
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
        salesCount: fiscalSalesCount,
        returnsCount: fiscalReturnsCount,
        netTotal: fiscalNet,
        failedCount: failedFiscalCount,
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
        marketingTotal: round2(
          periodMarketingDocs.reduce(
            (sum, row) => sum + (Number(row.amount) || 0),
            0
          )
        ),
        marketingCount: periodMarketingDocs.length,
      },
      operational: {
        producerSharePercent: split.sharePercent,
        producerShareAmount: split.producerShare,
        cinemaTicketKeep: split.cinemaKeep,
        operatingExpensesTotal,
        statutoryPaymentsTotal,
        expensesByCategory,
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

export async function exportPekDeclarationXml(params: {
  year: number;
  quarter: number;
}): Promise<{
  success: boolean;
  error: string | null;
  xml: string | null;
  filename: string | null;
}> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', xml: null, filename: null };
  }

  const year = Number(params.year);
  const quarter = Math.min(4, Math.max(1, Math.floor(Number(params.quarter)))) as
    | 1
    | 2
    | 3
    | 4;
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return { success: false, error: 'Տարին սխալ է', xml: null, filename: null };
  }

  const dashboard = await getAccountingDashboard({ year, quarter });
  if (!dashboard.success || !dashboard.data) {
    return {
      success: false,
      error: dashboard.error || 'Հաշվարկը ձախողվեց',
      xml: null,
      filename: null,
    };
  }

  const data = dashboard.data;
  let goodsCost = 0;
  let directOtherCost = 0;
  let sharedSellingAdmin = 0;
  for (const row of data.documents.rows) {
    const kind = pekCostBucket(row.costType, row.deductible);
    const amount = Number(row.amount) || 0;
    if (kind === 'goods') goodsCost += amount;
    else if (kind === 'directOther') directOtherCost += amount;
    else if (kind === 'shared') sharedSellingAdmin += amount;
  }

  const allocated = allocatePekCosts({
    ticketsTurnover: data.tax.tickets.turnover,
    productsTurnover: data.tax.products.turnover,
    goodsCost,
    directOtherCost,
    sharedSellingAdmin,
  });

  const xml = buildPekXml({
    year,
    quarter,
    field_5_1: data.tax.products.turnover,
    field_5_4_1: allocated.field_5_4_1,
    field_5_4_2: allocated.field_5_4_2,
    field_5_7: data.tax.products.carriedInDeduction,
    field_9_1: data.tax.tickets.turnover,
    field_9_4_1: allocated.field_9_4_1,
    field_9_4_2: allocated.field_9_4_2,
    field_9_7: data.tax.tickets.carriedInDeduction,
  });

  return {
    success: true,
    error: null,
    xml,
    filename: pekXmlFilename(year, quarter),
  };
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

function uniquePositiveIds(values: number[] | undefined): number[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((id) => Math.trunc(Number(id)))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );
}

async function cancelAccountingTicketById(
  id: number,
  adminId: number | null
): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      payment: true,
      order: {
        include: {
          orderItems: {
            include: { product: { select: { category: true } } },
          },
        },
      },
    },
  });
  if (!ticket || ticket.status === 'cancelled') return false;

  const itemsToRestore = (ticket.order?.orderItems ?? []).filter(
    (item) => item.ticketId === id
  );

  await prisma.$transaction(
    async (tx) => {
      await tx.ticket.update({
        where: { id },
        data: { status: 'cancelled' },
      });
      if (ticket.payment) {
        await tx.payment.update({
          where: { id: ticket.payment.id },
          data: { status: 'refunded' },
        });
      }
      for (const item of itemsToRestore) {
        await returnOrderItemStock(
          tx,
          item.id,
          item.productId,
          item.product?.category ?? 'snack',
          item.quantity
        );
      }
      await revokeBonusForTicket(tx, id, adminId);
      if (ticket.orderId) {
        const remainingTickets = await tx.ticket.count({
          where: {
            orderId: ticket.orderId,
            status: { not: 'cancelled' },
          },
        });
        if (remainingTickets === 0) {
          await tx.order.update({
            where: { id: ticket.orderId },
            data: { status: 'cancelled' },
          });
          await revokeBonusForOrder(tx, ticket.orderId, adminId);
        }
      }
    },
    { timeout: 15000 }
  );
  return true;
}

async function cancelAccountingOrderById(
  id: number,
  adminId: number | null
): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: { include: { product: { select: { category: true } } } },
    },
  });
  if (!order || order.status === 'cancelled') return false;

  await prisma.$transaction(
    async (tx) => {
      for (const item of order.orderItems) {
        await returnOrderItemStock(
          tx,
          item.id,
          item.productId,
          item.product?.category ?? 'snack',
          item.quantity
        );
      }
      await tx.order.update({
        where: { id },
        data: { status: 'cancelled' },
      });
      await revokeBonusForOrder(tx, id, adminId);
    },
    { timeout: 15000 }
  );
  return true;
}

export async function removeAccountingTicket(
  ticketId: number
): Promise<{ success: boolean; error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }
  const id = Math.trunc(Number(ticketId));
  if (!Number.isFinite(id) || id <= 0) {
    return { success: false, error: 'Սխալ տոմս' };
  }

  try {
    const cancelled = await cancelAccountingTicketById(
      id,
      Number(admin.id) || null
    );
    if (!cancelled) {
      return { success: false, error: 'Տոմսը չի գտնվել կամ արդեն չեղարկված է' };
    }
    revalidatePath('/admin/accounting');
    return { success: true, error: null };
  } catch (err) {
    console.error('[removeAccountingTicket]', err);
    return { success: false, error: 'Տոմսի չեղարկումը ձախողվեց' };
  }
}

export async function removeAccountingOrder(
  orderId: number
): Promise<{ success: boolean; error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }
  const id = Math.trunc(Number(orderId));
  if (!Number.isFinite(id) || id <= 0) {
    return { success: false, error: 'Սխալ պատվեր' };
  }

  try {
    const cancelled = await cancelAccountingOrderById(
      id,
      Number(admin.id) || null
    );
    if (!cancelled) {
      return { success: false, error: 'Պատվերը չի գտնվել կամ արդեն չեղարկված է' };
    }
    revalidatePath('/admin/accounting');
    return { success: true, error: null };
  } catch (err) {
    console.error('[removeAccountingOrder]', err);
    return { success: false, error: 'Պատվերի չեղարկումը ձախողվեց' };
  }
}

export async function removeAccountingMismatchItems(input: {
  receiptIds?: number[];
  ticketIds?: number[];
  orderIds?: number[];
}): Promise<{
  success: boolean;
  error: string | null;
  deleted: { receipts: number; tickets: number; orders: number };
}> {
  const empty = { receipts: 0, tickets: 0, orders: 0 };
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', deleted: empty };
  }

  const receiptIds = uniquePositiveIds(input.receiptIds);
  const ticketIds = uniquePositiveIds(input.ticketIds);
  const orderIds = uniquePositiveIds(input.orderIds);
  if (receiptIds.length + ticketIds.length + orderIds.length === 0) {
    return { success: false, error: 'Ընտրված գրառում չկա', deleted: empty };
  }

  const adminId = Number(admin.id) || null;
  const deleted = { ...empty };

  try {
    if (receiptIds.length > 0) {
      const result = await prisma.fiscalReceipt.deleteMany({
        where: { id: { in: receiptIds } },
      });
      deleted.receipts = result.count;
    }
    for (const id of ticketIds) {
      if (await cancelAccountingTicketById(id, adminId)) deleted.tickets += 1;
    }
    for (const id of orderIds) {
      if (await cancelAccountingOrderById(id, adminId)) deleted.orders += 1;
    }

    revalidatePath('/admin/accounting');
    revalidatePath('/admin/fiscal');
    return { success: true, error: null, deleted };
  } catch (err) {
    console.error('[removeAccountingMismatchItems]', err);
    return { success: false, error: 'Ջնջումը ձախողվեց', deleted };
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

export async function previewMetaAdsCsv(formData: FormData): Promise<{
  success: boolean;
  error: string | null;
  data: MetaAdsImportPreview | null;
}> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  try {
    const file = formData.get('file');
    if (!(file instanceof File) || file.size <= 0) {
      return { success: false, error: 'Ընտրեք Meta CSV ֆայլը', data: null };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: 'Ֆայլը չափազանց մեծ է (մինչև 2 ՄԲ)', data: null };
    }

    const text = await file.text();
    const parsed = parseMetaAdsInvoiceCsv(text);
    const invoiceNumbers = parsed.rows.map((row) =>
      metaInvoiceNumber(row.transactionId)
    );
    const existing = await prisma.taxDocument.findMany({
      where: { invoiceNumber: { in: invoiceNumbers } },
      select: { invoiceNumber: true },
    });
    const existingIds = new Set(
      existing.map((row) => row.invoiceNumber).filter(Boolean) as string[]
    );

    const items: MetaAdsImportPreviewItem[] = [];
    for (const row of parsed.rows) {
      const cba = await getCbaAmdRate(row.currency, row.date);
      const amountAmd = convertToAmd(row.amount, cba.amdPerUnit);
      items.push({
        transactionId: row.transactionId,
        date: row.date,
        originalAmount: row.amount,
        currency: row.currency,
        fxRate: cba.amdPerUnit,
        rateDate: cba.publishedDate,
        amountAmd,
        duplicate: existingIds.has(metaInvoiceNumber(row.transactionId)),
      });
    }

    const fresh = items.filter((row) => !row.duplicate);
    const currencies = Array.from(new Set(items.map((row) => row.currency)));

    return {
      success: true,
      error: null,
      data: {
        accountId: parsed.accountId,
        paymentMethod: parsed.paymentMethod,
        periodLabel: parsed.periodLabel,
        newCount: fresh.length,
        duplicateCount: items.length - fresh.length,
        totalOriginal: fresh.reduce((sum, row) => sum + row.originalAmount, 0),
        totalAmd: fresh.reduce((sum, row) => sum + row.amountAmd, 0),
        currency: currencies.length === 1 ? currencies[0] : null,
        items,
      },
    };
  } catch (error) {
    console.error('[previewMetaAdsCsv]', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'CSV-ն կարդալիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}

export async function confirmMetaAdsImport(input: {
  items: MetaAdsImportPreviewItem[];
}): Promise<{
  success: boolean;
  error: string | null;
  created: number;
  skipped: number;
}> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', created: 0, skipped: 0 };
  }

  const items = Array.isArray(input.items) ? input.items : [];
  const toCreate = items.filter(
    (row) =>
      !row.duplicate &&
      Number(row.amountAmd) > 0 &&
      String(row.transactionId || '').trim()
  );
  if (toCreate.length === 0) {
    return {
      success: false,
      error: 'Նոր վճարում չկա ավելացնելու (բոլորը արդեն գրանցված են)',
      created: 0,
      skipped: items.filter((row) => row.duplicate).length,
    };
  }

  try {
    const invoiceNumbers = toCreate.map((row) =>
      metaInvoiceNumber(row.transactionId)
    );
    const existing = await prisma.taxDocument.findMany({
      where: { invoiceNumber: { in: invoiceNumbers } },
      select: { invoiceNumber: true },
    });
    const existingIds = new Set(
      existing.map((row) => row.invoiceNumber).filter(Boolean) as string[]
    );

    let created = 0;
    let skipped = items.filter((row) => row.duplicate).length;
    const createdById = admin.id ? Number(admin.id) : null;

    for (const row of toCreate) {
      const invoiceNumber = metaInvoiceNumber(row.transactionId);
      if (existingIds.has(invoiceNumber)) {
        skipped += 1;
        continue;
      }
      const documentDate = parseDateOnly(row.date);
      if (!documentDate) {
        skipped += 1;
        continue;
      }
      const amountAmd = Math.round(Number(row.amountAmd) || 0);
      if (amountAmd <= 0) {
        skipped += 1;
        continue;
      }

      await prisma.taxDocument.create({
        data: {
          title: `Facebook Ads · ${row.originalAmount} ${row.currency}`,
          kind: 'other',
          stream: 'tickets',
          costType: 'marketing',
          deductible: true,
          supplierName: META_ADS_SUPPLIER_NAME,
          supplierTin: META_ADS_SUPPLIER_TIN,
          invoiceNumber,
          amount: amountAmd,
          documentDate,
          note: [
            `Meta Transaction ID: ${row.transactionId}`,
            `ԿԲ կուրս ${row.fxRate} ֏/${row.currency} (${row.rateDate})`,
          ].join(' · '),
          createdById: Number.isFinite(createdById) ? createdById : null,
        },
      });
      existingIds.add(invoiceNumber);
      created += 1;
    }

    await prisma.expense.deleteMany({
      where: { externalId: { startsWith: 'meta:' } },
    });

    revalidatePath('/admin/accounting');
    revalidatePath('/admin/expenses');
    return { success: created > 0, error: null, created, skipped };
  } catch (error) {
    console.error('[confirmMetaAdsImport]', error);
    return {
      success: false,
      error: 'Հաշիվները գրանցելիս սխալ է տեղի ունեցել',
      created: 0,
      skipped: 0,
    };
  }
}
