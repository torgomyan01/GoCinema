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
  type AccountingWarningDetails,
  type AccountingWarningFinding,
  type ProductCategoryRevenue,
  type QuarterHistoryPoint,
  type StreamTaxView,
  type TaxDocumentKind,
  type TaxDocumentRow,
} from '@/lib/accounting';
import { prisma } from '@/lib/prisma';
import { revokeBonusForOrder, revokeBonusForTicket } from '@/lib/bonus';
import { returnOrderItemStock } from '@/lib/product-units';
import { isAdminRole } from '@/lib/roles';
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

const FISCAL_MISMATCH_SAMPLE_LIMIT = 20;

function orderLineTotal(order: {
  orderItems: Array<{ quantity: number; price: number }>;
}): number {
  return order.orderItems.reduce((sum, item) => {
    const qty = Math.floor(Number(item.quantity)) || 0;
    return sum + qty * (Number(item.price) || 0);
  }, 0);
}

function toWarningFinding<T>(
  title: string,
  description: string,
  items: T[],
  amount: number,
  toSample: (item: T) => AccountingWarningFinding['samples'][number],
  extra?: Pick<AccountingWarningFinding, 'tone' | 'selectable'>
): AccountingWarningFinding | null {
  if (items.length === 0 && amount <= 0) return null;
  return {
    title,
    description,
    count: items.length,
    amount: round2(amount),
    samples: items.slice(0, FISCAL_MISMATCH_SAMPLE_LIMIT).map(toSample),
    tone: extra?.tone,
    selectable: extra?.selectable,
  };
}

function isOnlineUnfiscalizedPayment(row: {
  method?: string | null;
  transactionId?: string | null;
}): boolean {
  const method = (row.method || '').toLowerCase();
  if (method === 'cash') return false;
  const tx = (row.transactionId || '').trim().toUpperCase();
  if (tx.startsWith('BOXOFFICE-')) return false;
  return method === 'card' || method === 'bank_transfer';
}

async function buildFiscalMismatchDetails(params: {
  periodStart: Date;
  periodEnd: Date;
  year: number;
  quarter: number;
  fiscalSalesTotal: number;
  fiscalReturnsTotal: number;
  fiscalSalesCount: number;
  fiscalReturnsCount: number;
  fiscalNet: number;
  failedFiscalCount: number;
  ticketsNet: number;
  ticketsCount: number;
  productsNet: number;
  ticketRefundsProcessed: number;
  productReturnsProcessed: number;
  accountingTurnover: number;
  fiscalDifference: number;
  soldPayments: Array<{
    updatedAt: Date;
    ticketId: number;
    method?: string | null;
    transactionId?: string | null;
    ticket: { price: number } | null;
  }>;
  refundedPayments: Array<{
    createdAt: Date;
    updatedAt: Date;
    ticketId: number;
    ticket: { price: number } | null;
  }>;
  completedOrders: Array<{
    id: number;
    createdAt: Date;
    orderItems: Array<{ quantity: number; price: number }>;
  }>;
}): Promise<AccountingWarningDetails> {
  const {
    periodStart,
    periodEnd,
    year,
    quarter,
    fiscalSalesTotal,
    fiscalReturnsTotal,
    fiscalSalesCount,
    fiscalReturnsCount,
    fiscalNet,
    failedFiscalCount,
    ticketsNet,
    ticketsCount,
    productsNet,
    ticketRefundsProcessed,
    productReturnsProcessed,
    accountingTurnover,
    fiscalDifference,
    soldPayments,
    refundedPayments,
    completedOrders,
  } = params;

  const inPeriod = (date: Date) => date >= periodStart && date <= periodEnd;
  const periodSold = soldPayments.filter((row) => inPeriod(row.updatedAt));
  const periodOrders = completedOrders.filter((row) => inPeriod(row.createdAt));
  const ticketIds = Array.from(new Set(periodSold.map((row) => row.ticketId)));
  const orderIds = periodOrders.map((row) => row.id);
  const refundedTicketIds = new Set(
    refundedPayments.map((row) => row.ticketId)
  );

  const orFilters: Array<
    | { createdAt: { gte: Date; lte: Date } }
    | { ticketId: { in: number[] } }
    | { orderId: { in: number[] } }
  > = [{ createdAt: { gte: periodStart, lte: periodEnd } }];
  if (ticketIds.length > 0) {
    orFilters.push({ ticketId: { in: ticketIds.slice(0, 4000) } });
  }
  if (orderIds.length > 0) {
    orFilters.push({ orderId: { in: orderIds.slice(0, 4000) } });
  }

  const receipts = await prisma.fiscalReceipt.findMany({
    where: { OR: orFilters },
    select: {
      id: true,
      operation: true,
      status: true,
      total: true,
      ticketId: true,
      orderId: true,
      createdAt: true,
      fiscalTime: true,
      fiscalNumber: true,
      errorMessage: true,
      source: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const printedSales = receipts.filter(
    (row) => row.operation === 'sale' && row.status === 'printed'
  );
  const saleByTicket = new Map<number, (typeof receipts)[number]>();
  const saleByOrder = new Map<number, (typeof receipts)[number]>();
  for (const row of printedSales) {
    if (row.ticketId != null && !saleByTicket.has(row.ticketId)) {
      saleByTicket.set(row.ticketId, row);
    }
    if (row.orderId != null && !saleByOrder.has(row.orderId)) {
      saleByOrder.set(row.orderId, row);
    }
  }

  const ticketsWithAnyFiscal = new Set(
    receipts
      .filter((row) => row.ticketId != null)
      .map((row) => row.ticketId as number)
  );
  const ticketsWithoutPrintedSale = periodSold.filter(
    (row) => !saleByTicket.has(row.ticketId)
  );
  const onlineTicketsWithoutHdm = ticketsWithoutPrintedSale.filter(
    (row) =>
      !ticketsWithAnyFiscal.has(row.ticketId) &&
      isOnlineUnfiscalizedPayment(row)
  );
  const boxOfficeTicketsWithoutReceipt = ticketsWithoutPrintedSale.filter(
    (row) =>
      ticketsWithAnyFiscal.has(row.ticketId) ||
      !isOnlineUnfiscalizedPayment(row)
  );
  const onlineTurnover = round2(
    onlineTicketsWithoutHdm.reduce(
      (sum, row) => sum + (Number(row.ticket?.price) || 0),
      0
    )
  );
  const residualDifference = round2(fiscalDifference + onlineTurnover);
  const ordersWithoutReceipt = periodOrders.filter(
    (row) => !saleByOrder.has(row.id)
  );

  const ticketSaleOutsideQuarter = periodSold.flatMap((row) => {
    const receipt = saleByTicket.get(row.ticketId);
    if (!receipt || inPeriod(receipt.createdAt)) return [];
    return [{ row, receipt }];
  });
  const orderSaleOutsideQuarter = periodOrders.flatMap((row) => {
    const receipt = saleByOrder.get(row.id);
    if (!receipt || inPeriod(receipt.createdAt)) return [];
    return [{ row, receipt }];
  });

  const periodPrintedSales = printedSales.filter((row) =>
    inPeriod(row.createdAt)
  );
  const soldTicketIds = new Set(periodSold.map((row) => row.ticketId));
  const soldOrderIds = new Set(periodOrders.map((row) => row.id));

  const unlinkedReceipts = periodPrintedSales.filter(
    (row) => row.ticketId == null && row.orderId == null
  );
  const receiptTicketOtherQuarter = periodPrintedSales.filter(
    (row) =>
      row.ticketId != null &&
      !soldTicketIds.has(row.ticketId) &&
      !refundedTicketIds.has(row.ticketId)
  );
  const periodReturnsByTicket = new Set(
    receipts
      .filter(
        (row) =>
          row.operation === 'return' &&
          row.status === 'printed' &&
          inPeriod(row.createdAt) &&
          row.ticketId != null
      )
      .map((row) => row.ticketId as number)
  );
  const receiptRefundedTicket = periodPrintedSales.filter(
    (row) =>
      row.ticketId != null &&
      refundedTicketIds.has(row.ticketId) &&
      !periodReturnsByTicket.has(row.ticketId)
  );
  const receiptOrderOtherQuarter = periodPrintedSales.filter(
    (row) => row.orderId != null && !soldOrderIds.has(row.orderId)
  );

  const failedReceipts = receipts.filter(
    (row) => row.status === 'failed' && inPeriod(row.createdAt)
  );
  const timeMismatchReceipts = receipts.filter((row) => {
    if (!row.fiscalTime || !inPeriod(row.createdAt)) return false;
    return (
      bucketId(row.createdAt.getFullYear(), quarterOfMonth(row.createdAt.getMonth())) !==
      bucketId(
        row.fiscalTime.getFullYear(),
        quarterOfMonth(row.fiscalTime.getMonth())
      )
    );
  });

  const findings = [
    toWarningFinding(
      'Օնլայն տոմսեր · ՀԴՄ չի տպվում',
      'Օնլայն վճարված տոմսեր։ Մտնում են հարկման բազա, ՀԴՄ կտրոն չի տպվում և սխալ չեն համարվում։',
      onlineTicketsWithoutHdm,
      onlineTurnover,
      (row) => ({
        ref: `Տոմս #${row.ticketId}`,
        amount: Number(row.ticket?.price) || 0,
        date: row.updatedAt.toISOString(),
        note:
          row.method === 'bank_transfer'
            ? 'օնլայն · բանկային փոխանցում · հարկման բազայում է'
            : 'օնլայն · քարտ · հարկման բազայում է',
        badge: 'օնլայն',
      }),
      { tone: 'info', selectable: false }
    ),
    toWarningFinding(
      'Դրամարկղի տոմս առանց տպված կտրոնի',
      'Դրամարկղի վաճառք է, բայց տպված ՀԴՄ կտրոն չկա։ Սովորաբար failed տպում է — ստուգեք /admin/fiscal։',
      boxOfficeTicketsWithoutReceipt,
      boxOfficeTicketsWithoutReceipt.reduce(
        (sum, row) => sum + (Number(row.ticket?.price) || 0),
        0
      ),
      (row) => ({
        ref: `Տոմս #${row.ticketId}`,
        amount: Number(row.ticket?.price) || 0,
        date: row.updatedAt.toISOString(),
        note: row.method
          ? `դրամարկղ · ${row.method} · կտրոն չկա`
          : 'դրամարկղ · կտրոն չկա',
        ticketId: row.ticketId,
      })
    ),
    toWarningFinding(
      'Ապրանքի պատվեր առանց տպված կտրոնի',
      'Completed order կա, բայց այս պատվերին կապված printed sale կտրոն չի գտնվել։',
      ordersWithoutReceipt,
      ordersWithoutReceipt.reduce((sum, row) => sum + orderLineTotal(row), 0),
      (row) => ({
        ref: `Պատվեր #${row.id}`,
        amount: orderLineTotal(row),
        date: row.createdAt.toISOString(),
        note: 'order completed · կտրոն չկա',
        orderId: row.id,
      })
    ),
    toWarningFinding(
      'Տոմսի կտրոնը այլ եռամսյակում է',
      'Տոմսը վաճառվել է այս եռամսյակում, իսկ ՀԴՄ կտրոնը գրանցվել է այլ ժամանակաշրջանում։',
      ticketSaleOutsideQuarter,
      ticketSaleOutsideQuarter.reduce(
        (sum, { receipt, row }) =>
          sum + (Number(receipt.total) || Number(row.ticket?.price) || 0),
        0
      ),
      ({ row, receipt }) => ({
        ref: `Տոմս #${row.ticketId} · կտրոն #${receipt.id}`,
        amount: Number(receipt.total) || Number(row.ticket?.price) || 0,
        date: receipt.createdAt.toISOString(),
        note: `վաճառք՝ ${row.updatedAt.toISOString().slice(0, 10)} · կտրոն՝ ${receipt.createdAt.toISOString().slice(0, 10)}`,
        receiptId: receipt.id,
        ticketId: row.ticketId,
      })
    ),
    toWarningFinding(
      'Պատվերի կտրոնը այլ եռամսյակում է',
      'Պատվերը այս եռամսյակում է, կտրոնը՝ այլ։',
      orderSaleOutsideQuarter,
      orderSaleOutsideQuarter.reduce(
        (sum, { receipt, row }) =>
          sum + (Number(receipt.total) || orderLineTotal(row)),
        0
      ),
      ({ row, receipt }) => ({
        ref: `Պատվեր #${row.id} · կտրոն #${receipt.id}`,
        amount: Number(receipt.total) || orderLineTotal(row),
        date: receipt.createdAt.toISOString(),
        note: `պատվեր՝ ${row.createdAt.toISOString().slice(0, 10)} · կտրոն՝ ${receipt.createdAt.toISOString().slice(0, 10)}`,
        receiptId: receipt.id,
        orderId: row.id,
      })
    ),
    toWarningFinding(
      'ՀԴՄ կտրոն առանց տոմսի/պատվերի',
      'Printed sale կտրոնը այս եռամսյակում է, բայց ticketId և orderId չունի։ Հաշվառման բազային չի կապվում։',
      unlinkedReceipts,
      unlinkedReceipts.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
      (row) => ({
        ref: row.fiscalNumber
          ? `Կտրոն #${row.id} · № ${row.fiscalNumber}`
          : `Կտրոն #${row.id}`,
        amount: Number(row.total) || 0,
        date: row.createdAt.toISOString(),
        note: row.source === 'scanner' ? 'scanner' : 'box_office',
        receiptId: row.id,
      })
    ),
    toWarningFinding(
      'Կտրոն՝ տոմսը այլ եռամսյակի վաճառք է',
      'ՀԴՄ կտրոնը այս եռամսյակում է, իսկ կապված տոմսի վճարումը՝ ոչ։',
      receiptTicketOtherQuarter,
      receiptTicketOtherQuarter.reduce(
        (sum, row) => sum + (Number(row.total) || 0),
        0
      ),
      (row) => ({
        ref: `Կտրոն #${row.id} · տոմս #${row.ticketId}`,
        amount: Number(row.total) || 0,
        date: row.createdAt.toISOString(),
        note: row.fiscalNumber ? `ՀԴՄ № ${row.fiscalNumber}` : 'տոմսը այս Q-ում չէ',
        receiptId: row.id,
        ticketId: row.ticketId ?? undefined,
      })
    ),
    toWarningFinding(
      'Կտրոն՝ վերադարձված տոմսի վաճառք',
      'Վաճառքի կտրոնը մնացել է, տոմսը հետո չեղարկվել է։ Եթե վերադարձի կտրոնը այլ եռամսյակում է, զուտերը չեն համընկնի։',
      receiptRefundedTicket,
      receiptRefundedTicket.reduce(
        (sum, row) => sum + (Number(row.total) || 0),
        0
      ),
      (row) => ({
        ref: `Կտրոն #${row.id} · տոմս #${row.ticketId}`,
        amount: Number(row.total) || 0,
        date: row.createdAt.toISOString(),
        note: 'տոմսը refunded/cancelled է',
        receiptId: row.id,
        ticketId: row.ticketId ?? undefined,
      })
    ),
    toWarningFinding(
      'Կտրոն՝ պատվերը այլ եռամսյակում է',
      'ՀԴՄ կտրոնը այս եռամսյակում է, կապված order-ը՝ ոչ (կամ ջնջված է)։',
      receiptOrderOtherQuarter,
      receiptOrderOtherQuarter.reduce(
        (sum, row) => sum + (Number(row.total) || 0),
        0
      ),
      (row) => ({
        ref: `Կտրոն #${row.id} · պատվեր #${row.orderId}`,
        amount: Number(row.total) || 0,
        date: row.createdAt.toISOString(),
        note: row.fiscalNumber ? `ՀԴՄ № ${row.fiscalNumber}` : 'պատվերը այս Q-ում չէ',
        receiptId: row.id,
        orderId: row.orderId ?? undefined,
      })
    ),
    toWarningFinding(
      'Չտպված (failed) կտրոններ',
      'ՀԴՄ տպումը ձախողվել է։ Հաշվառման վաճառքը կարող է մնալ, ֆիսկալ զուտը՝ ոչ։',
      failedReceipts,
      failedReceipts.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
      (row) => ({
        ref: row.ticketId
          ? `Կտրոն #${row.id} · տոմս #${row.ticketId}`
          : row.orderId
            ? `Կտրոն #${row.id} · պատվեր #${row.orderId}`
            : `Կտրոն #${row.id}`,
        amount: Number(row.total) || 0,
        date: row.createdAt.toISOString(),
        note: row.errorMessage?.slice(0, 120) || 'status=failed',
        receiptId: row.id,
        ticketId: row.ticketId ?? undefined,
        orderId: row.orderId ?? undefined,
      })
    ),
    toWarningFinding(
      'ՀԴՄ ժամը և գրանցման ժամը տարբեր եռամսյակում',
      'ՊԵԿ պորտալը սովորաբար նայում է ՀԴՄ fiscal time, իսկ այս էջը՝ կտրոնի գրանցման ժամը։',
      timeMismatchReceipts,
      timeMismatchReceipts.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
      (row) => ({
        ref: row.fiscalNumber
          ? `Կտրոն #${row.id} · № ${row.fiscalNumber}`
          : `Կտրոն #${row.id}`,
        amount: Number(row.total) || 0,
        date: row.createdAt.toISOString(),
        note: `գրանցում՝ ${row.createdAt.toISOString().slice(0, 10)} · ՀԴՄ ժամ՝ ${row.fiscalTime?.toISOString().slice(0, 10) ?? '—'}`,
        receiptId: row.id,
        ticketId: row.ticketId ?? undefined,
        orderId: row.orderId ?? undefined,
      })
    ),
  ].filter((row): row is AccountingWarningFinding => Boolean(row));

  const residualHigher = residualDifference > 0;

  return {
    title: `${year} Q${quarter} · ինչ ենք համեմատում`,
    comparison: [
      {
        label: `ՀԴՄ տպված վաճառքի կտրոններ (${fiscalSalesCount})`,
        value: formatAmdText(fiscalSalesTotal),
      },
      {
        label: `ՀԴՄ տպված վերադարձի կտրոններ (${fiscalReturnsCount})`,
        value: `− ${formatAmdText(fiscalReturnsTotal)}`,
      },
      {
        label: 'ՀԴՄ զուտ = վաճառք − վերադարձ',
        value: formatAmdText(fiscalNet),
      },
      {
        label: `Ծրագրի տոմսեր, վճարված և չվերադարձված (${ticketsCount} հատ)`,
        value: formatAmdText(ticketsNet),
      },
      {
        label: 'Ծրագրի ապրանքներ (completed պատվեր)',
        value: formatAmdText(productsNet),
      },
      {
        label: `Օնլայն տոմսեր · հարկման բազայում, ՀԴՄ չի տպվում (${onlineTicketsWithoutHdm.length} հատ)`,
        value: formatAmdText(onlineTurnover),
      },
      {
        label: 'Այս եռամսյակում ձևակերպված տոմսի վերադարձ',
        value: formatAmdText(ticketRefundsProcessed),
      },
      {
        label: 'Ապրանքի վերադարձի կտրոններ (տեղեկատվական)',
        value: formatAmdText(productReturnsProcessed),
      },
      {
        label: 'Հաշվառման շրջանառություն = տոմս + ապրանք (ներառյալ օնլայն)',
        value: formatAmdText(accountingTurnover),
      },
      {
        label: residualHigher
          ? 'ՀԴՄ vs դրամարկղ · ՀԴՄ-ն ավելի մեծ է'
          : 'ՀԴՄ vs դրամարկղ · հաշվառումն ավելի մեծ է',
        value: `${residualDifference > 0 ? '+' : residualDifference < 0 ? '−' : ''}${formatAmdText(Math.abs(residualDifference))}`,
      },
      {
        label: 'Չտպված (failed) կտրոններ այս եռամսյակում',
        value: String(failedFiscalCount),
      },
    ],
    findings,
    hints: [
      'Օնլայն տոմսերը մտնում են հարկման բազա, բայց ՀԴՄ չեն տպվում և սխալ չեն։',
      residualHigher
        ? 'Մնացած տարբերությունը դրամարկղի/սկաների կողմն է՝ կտրոն առանց վաճառքի կամ այլ եռամսյակ։'
        : 'Մնացած տարբերությունը դրամարկղի կողմն է՝ տոմս/պատվեր առանց տպված կտրոնի կամ failed տպում։',
      'Հարկման բազան ամբողջ հաշվառումն է (տոմս + ապրանք + օնլայն)։ ՀԴՄ համեմատությունը միայն դրամարկղի ֆիսկալացումն է ստուգում։',
    ],
    href: { label: 'Բացել ՀԴՄ կտրոնները', href: '/admin/fiscal' },
    onlineTurnover,
    onlineCount: onlineTicketsWithoutHdm.length,
    residualDifference,
  };
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
      periodExpenses,
    ] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: 'completed',
          updatedAt: { gte: windowStart, lte: periodEnd },
          ticket: { status: { in: ['paid', 'used'] } },
        },
        select: {
          updatedAt: true,
          ticketId: true,
          method: true,
          transactionId: true,
          ticket: { select: { price: true } },
        },
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
          ticketId: true,
          ticket: { select: { price: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          status: 'completed',
          createdAt: { gte: windowStart, lte: periodEnd },
        },
        select: {
          id: true,
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
    const mismatchDetails = await buildFiscalMismatchDetails({
      periodStart,
      periodEnd,
      year,
      quarter,
      fiscalSalesTotal,
      fiscalReturnsTotal,
      fiscalSalesCount: fiscalSales._count._all,
      fiscalReturnsCount: fiscalReturns._count._all,
      fiscalNet,
      failedFiscalCount,
      ticketsNet,
      ticketsCount: selectedBucket.ticketsCount,
      productsNet,
      ticketRefundsProcessed: round2(selectedBucket.ticketRefundsProcessed),
      productReturnsProcessed: round2(selectedBucket.productReturnsProcessed),
      accountingTurnover,
      fiscalDifference,
      soldPayments,
      refundedPayments,
      completedOrders,
    });
    const onlineTicketsAmount = mismatchDetails.onlineTurnover ?? 0;
    const onlineTicketsCount = mismatchDetails.onlineCount ?? 0;
    const residualDifference =
      mismatchDetails.residualDifference ?? fiscalDifference;

    const residualMismatch =
      Math.abs(residualDifference) >
      Math.max(1000, accountingTurnover * 0.01);

    if (onlineTicketsAmount > 0) {
      warnings.push({
        level: 'info',
        message: [
          `Օնլայն տոմսեր՝ ${formatAmdText(onlineTicketsAmount)} (${onlineTicketsCount} հատ)։`,
          'Մտնում են հարկման բազա, ՀԴՄ չի տպվում և սխալ չեն համարվում։',
        ].join('\n'),
        details: residualMismatch ? undefined : mismatchDetails,
      });
    }

    if (residualMismatch) {
      const residualHigher = residualDifference > 0;
      warnings.push({
        level: 'warning',
        message: [
          'ՀԴՄ տպված կտրոնները և դրամարկղի/սկաների վաճառքը չեն համընկնում։',
          `ՀԴՄ զուտ՝ ${formatAmdText(fiscalNet)} · հաշվառում առանց օնլայնի՝ ${formatAmdText(accountingTurnover - onlineTicketsAmount)} · մնացած տարբերություն՝ ${residualHigher ? '+' : '−'}${formatAmdText(Math.abs(residualDifference))}։`,
          onlineTicketsAmount > 0
            ? `Օնլայն ${formatAmdText(onlineTicketsAmount)}-ը հարկման բազայում է, այս համեմատությունից դուրս է։`
            : residualHigher
              ? 'ՀԴՄ-ն ավելի մեծ է՝ կան տպված կտրոններ առանց այս եռամսյակի վաճառքի։'
              : 'Դրամարկղում կան վաճառքներ առանց տպված ՀԴՄ կտրոնի։',
          '«Մանրամասներ»-ում երևում են կոնկրետ տոմսերը, պատվերներն ու կտրոնները։',
        ].join('\n'),
        details: mismatchDetails,
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
        salesCount: fiscalSales._count._all,
        returnsCount: fiscalReturns._count._all,
        netTotal: fiscalNet,
        failedCount: failedFiscalCount,
        retroactiveRefunds: round2(selectedBucket.retroactiveRefunds),
        difference: fiscalDifference,
        onlineTicketsAmount,
        onlineTicketsCount,
        differenceAfterOnline: residualDifference,
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
