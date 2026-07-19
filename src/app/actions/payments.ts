'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import {
  TELCELL_INVOICE_URL,
  buildTelcellInvoiceSecurityCode,
  toBase64,
} from '@/lib/telcell';
import {
  createVPostOrder,
  createVPostCustomer,
  fetchVPostTransactionsForOrder,
  resolveVPostTransactionsForGoCinemaOrder,
  buildVPostAttemptOrderId,
  confirmVPostPayment,
  cancelVPostPayment,
  getNormalizedTransactionsFromVPostEnvelope,
  hasVPostConfig,
  isVPostTwoPhaseEnabled,
  isVPostPaymentDeposited,
  isVPostPaymentDeclined,
  isVPostPaymentNeedsConfirmation,
  isVPostPaymentStarted,
  isVPostPaymentCaptured,
  getVPostPaymentState,
  getVPostTransactionAmount,
  buildVPostProviderInfoFromTransaction,
  mergeVPostProviderInfo,
  isApprovedResponseCode,
  summarizeTransactionForLog,
  fetchAllVPostTransactions,
  formatVPostDateParam,
  getVPostTransactionPartnerOrderId,
  getVPostActionOrderId,
  getVPostTransactionStatus,
  resolveGoCinemaOrderIdForDisplay,
  type VPostProviderInfo,
} from '@/lib/vpost';
import { isUnpaidHeldStatus, paymentGatewayHoldUntil } from '@/lib/reservation';
import { createNotification, formatAmd } from '@/lib/notifications';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminRole } from '@/lib/roles';
import { releaseExpiredReservations } from '@/app/actions/tickets';

function paymentServerLog(event: string, payload: Record<string, unknown>) {
  const log =
    (process.env.PAYMENT_LOG || '').toLowerCase() === 'true' ||
    (process.env.PAYMENT_LOG || '').toLowerCase() === '1' ||
    (process.env.PAYMENT_DEBUG || '').toLowerCase() === 'true' ||
    process.env.NODE_ENV === 'development';
  if (!log) return;
  try {
    console.info(`[Payment] ${event}`, JSON.stringify(payload));
  } catch {
    console.info(`[Payment] ${event}`, payload);
  }
}

export interface TelcellCheckoutData {
  url: string;
  fields: Record<string, string>;
}

export interface CreateTelcellInvoiceForOrderData {
  userId: number;
  orderId: number;
  method: 'card' | 'bank_transfer';
  ssn?: string;
}

export interface CreateVPostOrderForOrderData {
  userId: number;
  orderId: number;
}

function isOrderFullyPaid(tickets: Array<{ status: string }>): boolean {
  return (
    tickets.length > 0 &&
    tickets.every((t) => t.status === 'paid' || t.status === 'used')
  );
}

function parseStoredItfOrderId(
  tickets: Array<{ payment?: { transactionId?: string | null } | null }>
): number | undefined {
  const ids = parseStoredVPostRefs(tickets).itfOrderIds;
  return ids[0];
}

function parseStoredVPostRefs(
  tickets: Array<{ payment?: { transactionId?: string | null } | null }>
): { itfOrderIds: number[]; partnerOrderIds: number[] } {
  const itfOrderIds: number[] = [];
  const partnerOrderIds: number[] = [];
  const seenItf = new Set<number>();
  const seenPartner = new Set<number>();

  for (const ticket of tickets) {
    const raw = ticket.payment?.transactionId?.trim();
    if (!raw) continue;

    // Նոր ֆորմատ՝ ITF-123|P-456789012  կամ ITF-123;P-456
    const itfMatch = raw.match(/ITF-(\d+)/i);
    if (itfMatch) {
      const id = parseInt(itfMatch[1], 10);
      if (Number.isFinite(id) && id > 0 && !seenItf.has(id)) {
        seenItf.add(id);
        itfOrderIds.push(id);
      }
    }

    const partnerMatch = raw.match(/(?:^|[|;])P-(\d+)/i);
    if (partnerMatch) {
      const id = parseInt(partnerMatch[1], 10);
      if (Number.isFinite(id) && id > 0 && !seenPartner.has(id)) {
        seenPartner.add(id);
        partnerOrderIds.push(id);
      }
    }

    // Legacy՝ միայն թիվ կամ ITF-թիվ
    if (!itfMatch && !partnerMatch) {
      const bare = raw.match(/^(\d+)$/);
      if (bare) {
        const id = parseInt(bare[1], 10);
        if (Number.isFinite(id) && id > 0 && !seenItf.has(id)) {
          seenItf.add(id);
          itfOrderIds.push(id);
        }
      }
    }
  }

  return { itfOrderIds, partnerOrderIds };
}

function formatStoredVPostTransactionId(
  itfOrderId: string | number | undefined,
  partnerOrderId: number
): string {
  const itf =
    itfOrderId != null && String(itfOrderId).trim() !== ''
      ? `ITF-${String(itfOrderId).trim()}`
      : null;
  const partner = `P-${partnerOrderId}`;
  return itf ? `${itf}|${partner}` : partner;
}

/**
 * Կուտակում է բոլոր վճարման փորձերի ITF/P ref-երը (cross-day sync-ի համար)։
 * VARCHAR(255) սահմանում պահում է վերջին փորձերը։
 */
function mergeStoredVPostTransactionId(
  existing: string | null | undefined,
  itfOrderId: string | number | undefined,
  partnerOrderId: number
): string {
  const next = formatStoredVPostTransactionId(itfOrderId, partnerOrderId);
  const prev = existing?.trim();
  if (!prev) return next;

  // Արդեն կա այս partner փորձը — թարմացնում ենք ITF մասը եթե պետք է
  if (prev.includes(`P-${partnerOrderId}`)) {
    if (
      itfOrderId != null &&
      String(itfOrderId).trim() !== '' &&
      !prev.includes(`ITF-${String(itfOrderId).trim()}`)
    ) {
      const merged = `${prev},${next}`;
      return trimStoredVPostRefs(merged);
    }
    return prev;
  }

  return trimStoredVPostRefs(`${prev},${next}`);
}

function trimStoredVPostRefs(raw: string, maxLen = 255): string {
  if (raw.length <= maxLen) return raw;
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  while (parts.length > 1 && parts.join(',').length > maxLen) {
    parts.shift();
  }
  return parts.join(',').slice(0, maxLen);
}

async function upsertPendingPaymentsForOrder(
  userId: number,
  method: 'card' | 'bank_transfer' | 'cash',
  tickets: Array<{
    id: number;
    price: number;
    payment: { id: number; transactionId?: string | null } | null;
  }>
) {
  for (const ticket of tickets) {
    if (ticket.payment) {
      await prisma.payment.update({
        where: { ticketId: ticket.id },
        data: {
          amount: ticket.price,
          method,
          status: 'pending',
          // transactionId չենք զրոյացնում — նախորդ փորձերի ref-երը պահում ենք
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          userId,
          ticketId: ticket.id,
          amount: ticket.price,
          method,
          status: 'pending',
        },
      });
    }
  }
}

export interface SeatConflict {
  row: string;
  number: number;
}

async function finalizeOrderAsPaid(order: {
  id: number;
  userId: number;
  tickets: Array<{
    id: number;
    screeningId: number;
    seatId: number;
    price: number;
    status: string;
    qrCode: string | null;
    seat?: { row: string; number: number } | null;
  }>;
}): Promise<{ conflicts: SeatConflict[] }> {
  const conflicts: SeatConflict[] = [];

  // Ամբողջ finalize-ը մեկ ատոմ տրանզակցիայում — կիսատ վիճակ չառաջանա (crash-ի դեպքում)։
  await prisma.$transaction(
    async (tx) => {
      for (const ticket of order.tickets) {
        // Արդեն վճարված/օգտագործված տոմսերը պարզապես ապահովում ենք QR-ով
        if (ticket.status === 'paid' || ticket.status === 'used') {
          if (!ticket.qrCode) {
            await tx.ticket.update({
              where: { id: ticket.id },
              data: { qrCode: `TICKET-${ticket.id}` },
            });
          }
          continue;
        }

        // Կոնֆլիկտի ստուգում. այս ընթացքում ուրիշը չի՞ վճարել նույն տեղի համար
        const conflict = await tx.ticket.findFirst({
          where: {
            screeningId: ticket.screeningId,
            seatId: ticket.seatId,
            id: { not: ticket.id },
            status: { in: ['paid', 'used'] },
          },
          select: { id: true },
        });

        if (conflict) {
          // Տեղն արդեն զբաղված է — չեղարկենք ամրագրումը, վճարումը՝ վերադարձման ենթակա
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { status: 'cancelled' },
          });
          await tx.payment.updateMany({
            where: { ticketId: ticket.id },
            data: { status: 'refunded' },
          });
          conflicts.push(
            ticket.seat
              ? { row: ticket.seat.row, number: ticket.seat.number }
              : { row: '', number: ticket.seatId }
          );
          continue;
        }

        await tx.payment.upsert({
          where: { ticketId: ticket.id },
          update: {
            amount: ticket.price,
            method: 'card',
            status: 'completed',
          },
          create: {
            userId: order.userId,
            ticketId: ticket.id,
            amount: ticket.price,
            method: 'card',
            status: 'completed',
          },
        });

        // Կարգավիճակ + QR (սկաները կարդում է TICKET-{id}) միասին
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'paid', qrCode: `TICKET-${ticket.id}` },
        });
      }

      // Եթե բոլոր տեղերը կոնֆլիկտ էին — պատվերը ձախողված է, հակառակ դեպքում՝ կատարված
      const allConflicted =
        conflicts.length > 0 && conflicts.length === order.tickets.length;

      await tx.order.update({
        where: { id: order.id },
        data: { status: allConflicted ? 'failed' : 'completed' },
      });
    },
    { timeout: 15000 }
  );

  revalidatePath('/tickets');
  revalidatePath('/payment');

  return { conflicts };
}

async function markOrderAsFailed(order: {
  id: number;
  tickets: Array<{ id: number }>;
}) {
  const ticketIds = order.tickets.map((ticket) => ticket.id);

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: {
        ticketId: { in: ticketIds },
        status: { not: 'completed' },
      },
      data: {
        status: 'failed',
      },
    }),
    // Պատվերը մնում է 'pending'՝ հաճախորդին կրկին վճարելու հնարավորություն տալու համար
    prisma.order.update({
      where: { id: order.id },
      data: { status: 'pending' },
    }),
  ]);
}

function normalizePhoneForVPost(rawPhone: string): string {
  const cleaned = rawPhone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+374')) return cleaned;
  if (cleaned.startsWith('374')) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 9) {
    return `+374${cleaned.slice(1)}`;
  }
  if (/^\d{8}$/.test(cleaned)) {
    return `+374${cleaned}`;
  }
  return cleaned;
}

function isCustomerAlreadyExistsMessage(message?: string): boolean {
  if (!message) return false;
  return /already|exist|exists|уже/i.test(message);
}

function isCustomerAlreadyExistsResponse(response: any): boolean {
  if (!response) return false;

  if (isCustomerAlreadyExistsMessage(response.message)) {
    return true;
  }

  const errors = response?.data?.errors;
  if (!errors || typeof errors !== 'object') {
    return false;
  }

  const messages: string[] = [];
  for (const value of Object.values(errors)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') messages.push(item);
      }
    } else if (typeof value === 'string') {
      messages.push(value);
    }
  }

  return messages.some((m) => /already|exist|exists|уже/i.test(m));
}

function getTelcellConfig() {
  const issuerRaw =
    process.env.TELLCELL_ISSUER ||
    process.env.TELLCELL_SHOP_EMAIL ||
    process.env.TELLCELL_SHOP_ID ||
    process.env.TELLCEL_SHOP_ID;
  const secretKey =
    process.env.TELLCELL_SHOP_KEY || process.env.TELLCEL_SHOP_KEY;
  const currencyRaw = process.env.TELLCELL_CURRENCY || '֏';
  const validDays = process.env.TELLCELL_VALID_DAYS || '1';
  const lang = process.env.TELLCELL_LANG || 'am';

  const issuer = (issuerRaw || '').trim().replace(/^"(.*)"$/, '$1');
  const currencyNormalized = (currencyRaw || '').trim().replace(/^"(.*)"$/, '$1');
  const currency =
    currencyNormalized.toUpperCase() === 'AMD' ? '֏' : currencyNormalized || '֏';

  return {
    issuer,
    secretKey,
    currency,
    validDays,
    lang,
  };
}

export async function createVPostOrderForOrder(
  data: CreateVPostOrderForOrderData
) {
  try {
    if (!data.userId || !data.orderId) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    if (!hasVPostConfig()) {
      return {
        success: false,
        error: 'Քարտային վճարման կարգավորումները բացակայում են (.env)',
      };
    }

    // Նախ չեղարկենք լրացած hold-ները այս պատվերի ցուցադրությունների համար
    const screeningRows = await prisma.ticket.findMany({
      where: { orderId: data.orderId },
      select: { screeningId: true },
      distinct: ['screeningId'],
    });
    for (const row of screeningRows) {
      await releaseExpiredReservations(row.screeningId);
    }

    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        tickets: {
          include: {
            payment: true,
          },
        },
      },
    });

    if (!order) {
      return {
        success: false,
        error: 'Պատվերը չի գտնվել',
      };
    }

    if (order.userId !== data.userId) {
      return {
        success: false,
        error: 'Պատվերը ձերն չէ',
      };
    }

    if (isOrderFullyPaid(order.tickets)) {
      return {
        success: false,
        error: 'Պատվերը արդեն վճարված է',
      };
    }

    const unpaidTickets = order.tickets.filter((ticket) =>
      isUnpaidHeldStatus(ticket.status)
    );

    if (unpaidTickets.length === 0) {
      const allCancelled = order.tickets.every((t) => t.status === 'cancelled');
      if (allCancelled || order.status === 'failed') {
        return {
          success: false,
          error:
            'Վճարման ժամանակը սպառվել է։ Պատվերը չեղարկված է։ Խնդրում ենք նորից ամրագրել տեղերը։',
        };
      }
      return {
        success: false,
        error: 'Պատվերը վճարման ենթակա չէ',
      };
    }

    await upsertPendingPaymentsForOrder(data.userId, 'card', unpaidTickets);

    // Hold երկարացում՝ VPost էջում գտնվելու ընթացքում տեղը չբացվի
    const extendedHold = paymentGatewayHoldUntil();
    await prisma.ticket.updateMany({
      where: { id: { in: unpaidTickets.map((t) => t.id) } },
      data: { holdUntil: extendedHold },
    });

    const customerRegistration = await createVPostCustomer({
      customerID: String(order.user.id),
      // Some gateways are strict with locale-specific names, keep ASCII-safe default.
      firstName: 'GoCinema',
      phoneNumber: normalizePhoneForVPost(order.user.phone),
      ...(order.user.email ? { email: order.user.email } : {}),
    });

    if (
      !customerRegistration.status &&
      !isCustomerAlreadyExistsResponse(customerRegistration)
    ) {
      return {
        success: false,
        error:
          customerRegistration.message
            ? `vPost customer/new սխալ: ${customerRegistration.message}`
            : 'vPost customer/new սխալ',
      };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (!appUrl) {
      return {
        success: false,
        error: 'APP URL կարգավորումը բացակայում է (.env)',
      };
    }

    const base = appUrl.replace(/\/$/, '');
    // Մի ավելացնեք query այստեղ — vPost-ը կցում է ?orderId=… և URL-ում կրկնակի ? էր լինում
    const backURL = `${base}/payment/${order.id}/vpost-return`;
    // Ամեն սեղմման վրա նոր VPost պատվեր՝ եզակի partner orderID
    const partnerOrderId = buildVPostAttemptOrderId(order.id);
    const vpostResponse = await createVPostOrder({
      customerID: String(data.userId),
      amount: order.totalAmount,
      orderID: partnerOrderId,
      backURL,
      description: `GoCinema Order #${order.id}`,
      lang: 'hy',
    });

    if (!vpostResponse.status || !vpostResponse.data?.redirectURL) {
      paymentServerLog('vpost_order_new_failed', {
        orderId: order.id,
        partnerOrderId,
        envelopeStatus: vpostResponse.status,
        message: vpostResponse.message,
      });
      return {
        success: false,
        error:
          vpostResponse.message
            ? `vPost order/new սխալ: ${vpostResponse.message}`
            : 'vPost order/new սխալ',
      };
    }

    paymentServerLog('vpost_order_new_ok', {
      orderId: order.id,
      partnerOrderId,
      itfOrderId: vpostResponse.data?.itfOrderId,
      gatewayPartnerOrderId: vpostResponse.data?.partnerOrderId,
    });

    const itfOrderId = vpostResponse.data?.itfOrderId;

    // Կուտակել նախորդ փորձերի ref-երը + նորը
    const payments = await prisma.payment.findMany({
      where: { ticketId: { in: unpaidTickets.map((t) => t.id) } },
      select: { id: true, transactionId: true },
    });
    for (const payment of payments) {
      const storedTxId = mergeStoredVPostTransactionId(
        payment.transactionId,
        itfOrderId,
        partnerOrderId
      );
      await prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: storedTxId },
      });
    }

    return {
      success: true,
      redirectURL: vpostResponse.data.redirectURL,
      partnerOrderId,
      itfOrderId: itfOrderId != null ? String(itfOrderId) : undefined,
      holdUntil: extendedHold.toISOString(),
      message: 'Քարտային վճարման հղումը պատրաստ է',
    };
  } catch (error: any) {
    console.error('[Create VPost Order For Order] Error:', error);
    return {
      success: false,
      error: 'Քարտային վճարումը սկսելու ընթացքում սխալ է տեղի ունեցել',
    };
  }
}

export async function syncVPostOrderStatus(data: CreateVPostOrderForOrderData) {
  try {
    if (!data.userId || !data.orderId) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    if (!hasVPostConfig()) {
      return {
        success: false,
        error: 'Քարտային վճարման կարգավորումները բացակայում են (.env)',
      };
    }

    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
        tickets: {
          include: {
            payment: true,
            screening: {
              include: {
                movie: {
                  select: {
                    title: true,
                  },
                },
              },
            },
            seat: {
              select: {
                row: true,
                number: true,
              },
            },
          },
        },
        orderItems: {
          select: { quantity: true },
        },
      },
    });

    if (!order) {
      return {
        success: false,
        error: 'Պատվերը չի գտնվել',
      };
    }

    if (order.userId !== data.userId) {
      return {
        success: false,
        error: 'Պատվերը ձերն չէ',
      };
    }

    // DB-ում արդեն հաստատված է միայն եթե տոմսերն իսկապես paid/used են։
    // order.status === 'completed' միայնակ բավարար չէ — կարող է հին/սխալ վիճակ լինել։
    if (isOrderFullyPaid(order.tickets)) {
      paymentServerLog('vpost_sync_already_paid', { orderId: order.id });
      return {
        success: true,
        state: 'paid' as const,
        message: 'Վճարումը արդեն հաստատված է',
      };
    }

    const refs = parseStoredVPostRefs(order.tickets);
    const hasKnownRefs =
      refs.itfOrderIds.length > 0 || refs.partnerOrderIds.length > 0;
    const resolved = await resolveVPostTransactionsForGoCinemaOrder({
      orderId: order.id,
      knownItfOrderIds: refs.itfOrderIds,
      knownPartnerOrderIds: refs.partnerOrderIds,
      since: order.createdAt,
      light: hasKnownRefs,
    });

    let txList = resolved.list;
    let txResponse = {
      status: resolved.envelopeStatus,
      message: resolved.message,
      data: { list: txList },
    };
    const usedOrderId = refs.partnerOrderIds[0] ?? order.id;

    paymentServerLog('vpost_sync_raw', {
      orderId: order.id,
      usedOrderId,
      source: resolved.source,
      itfOrderIds: refs.itfOrderIds,
      partnerOrderIds: refs.partnerOrderIds,
      envelopeStatus: txResponse.status,
      message: txResponse.message,
      listLength: txList.length,
      items: txList.map(summarizeTransactionForLog),
    });

    const twoPhase = isVPostTwoPhaseEnabled();

    // Երկու փուլով վճարում — հաստատում (confirm-payment) անհրաժեշտ է։
    // Single-phase հաշվի դեպքում confirm չենք կանչում (ITF-ը վերադարձնում է
    // «Կարգավորումները չեն գտնվել»)՝ authorized-ն արդեն գանձված է։
    const txNeedingConfirm = twoPhase
      ? txList.find(isVPostPaymentNeedsConfirmation)
      : undefined;
    if (txNeedingConfirm) {
      const confirmOrderId =
        getVPostActionOrderId(txNeedingConfirm) ??
        refs.partnerOrderIds[0] ??
        order.id;
      paymentServerLog('vpost_confirm_attempt', {
        orderId: order.id,
        confirmOrderId,
        customerId: order.userId,
        amount: order.totalAmount,
      });
      const confirmResult = await confirmVPostPayment({
        orderID: confirmOrderId,
        customerID: String(order.userId),
        amount: order.totalAmount,
      });
      paymentServerLog('vpost_confirm_result', {
        orderId: order.id,
        status: confirmResult.status,
        message: confirmResult.message,
        responseCode: confirmResult.data?.responseCode,
        itfOrderId: confirmResult.data?.itfOrderId,
        partnerOrderId: confirmResult.data?.partnerOrderId,
      });

      if (confirmResult.status) {
        const refreshed = await resolveVPostTransactionsForGoCinemaOrder({
          orderId: order.id,
          knownItfOrderIds: refs.itfOrderIds,
          knownPartnerOrderIds: refs.partnerOrderIds,
          since: order.createdAt,
          light: true,
        });
        txResponse = {
          status: refreshed.envelopeStatus,
          message: refreshed.message,
          data: { list: refreshed.list },
        };
        txList = refreshed.list;
      } else if (
        confirmResult.data?.responseCode === '00' ||
        isApprovedResponseCode(confirmResult.data?.responseCode)
      ) {
        // Պատասխանը հաջող է, բայց envelope.status=false — շարունակում ենք
        txList = [
          {
            order: {
              id: confirmResult.data?.itfOrderId
                ? parseInt(String(confirmResult.data.itfOrderId), 10)
                : order.id,
              partnerOrderId: order.id,
              status: 2,
            },
            response: {
              ResponseCode: confirmResult.data?.responseCode,
              PaymentState: 'payment_deposited',
              OrderStatus: '2',
            },
          },
        ];
      }
    }

    if (!txResponse.status && txList.length === 0) {
      const msg = (txResponse.message || '').toLowerCase();
      const maybeEmpty =
        msg.includes('no_payment') ||
        msg.includes('no payments') ||
        msg.includes('unregistered') ||
        msg.includes('0-100');
      if (maybeEmpty || !txResponse.message) {
        return {
          success: true,
          state: 'pending' as const,
          canRestart: true,
          message: 'Վճարումը դեռ ընթացքի մեջ է կամ դեռ չի գտնվել',
        };
      }
      return {
        success: false,
        error:
          txResponse.message ||
          'vPost transactions/list — անհաջող պատասխան (տես սերվերի լոգ)',
      };
    }

    if (txList.length === 0) {
      return {
        success: true,
        state: 'pending' as const,
        canRestart: true,
        message: 'Վճարումը դեռ ընթացքի մեջ է',
      };
    }

    // Ամենանոր գործարքի վիճակը՝ լոգի համար
    const newestTx = txList[0];
    const newestState = getVPostPaymentState(newestTx);
    paymentServerLog('vpost_sync_newest', {
      orderId: order.id,
      newestState,
      orderInternalStatus: newestTx.order?.status,
    });

    // ՎՃԱՐՎԱԾ որոշում — ՄԻԱՅՆ երբ vPost-ը հստակ հաստատել է։
    // - two-phase՝ միայն `payment_deposited`
    // - single-phase՝ `payment_approved`/`autoauthorized`/`deposited`
    const paidTx = twoPhase
      ? txList.find(isVPostPaymentDeposited)
      : txList.find(isVPostPaymentCaptured);

    // Եթե հաստատված գործարք չկա, և ամենանորը դեռ payment_started (0) է
    // (օր. օգտատերը back է արել առանց վճարման) → Չենք մարկում paid։
    if (!paidTx && isVPostPaymentStarted(newestTx)) {
      paymentServerLog('vpost_sync_decision', {
        orderId: order.id,
        decision: 'pending',
        reason: 'payment_started_not_confirmed',
      });
      return {
        success: true,
        state: 'pending' as const,
        canRestart: true,
        message: 'Վճարումը դեռ հաստատված չէ',
      };
    }
    if (paidTx) {
      // Գումարի ստուգում — կանխել թերավճարով տոմս ստանալը (fabricated tx-ի դեպքում amount չկա)
      const paidAmount = getVPostTransactionAmount(paidTx);
      if (paidAmount != null && paidAmount + 1 < order.totalAmount) {
        paymentServerLog('vpost_amount_mismatch', {
          orderId: order.id,
          expected: order.totalAmount,
          paidAmount,
        });
        return {
          success: false,
          error:
            'Վճարված գումարը չի համընկնում պատվերի գումարին։ Դիմեք աջակցությանը։',
        };
      }

      paymentServerLog('vpost_sync_decision', {
        orderId: order.id,
        decision: 'paid',
        paidAmount,
      });
      const { conflicts } = await finalizeOrderAsPaid({
        id: order.id,
        userId: order.userId,
        tickets: order.tickets.map((t) => ({
          id: t.id,
          screeningId: t.screeningId,
          seatId: t.seatId,
          price: t.price,
          status: t.status,
          qrCode: t.qrCode,
          seat: t.seat,
        })),
      });

      revalidatePath('/tickets');
      revalidatePath('/payment');
      revalidatePath('/checkout');

      // Ադմինի ծանուցում՝ նոր օնլայն վճարված տոմս(եր)
      const paidTicketCount = order.tickets.length - conflicts.length;
      if (paidTicketCount > 0) {
        const movieTitles = Array.from(
          new Set(
            order.tickets
              .map((t) => t.screening?.movie?.title)
              .filter((title): title is string => Boolean(title))
          )
        );
        const movieLabel =
          movieTitles.length > 0 ? movieTitles.join(', ') : 'ֆիլմ';
        const productCount = order.orderItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
        const productNote =
          productCount > 0 ? ` + ${productCount} ապրանք` : '';

        await createNotification({
          type: productCount > 0 ? 'online_product' : 'online_ticket',
          title: 'Նոր օնլայն վճարում (քարտով)',
          message: `Պատվեր #${order.id}: ${movieLabel} — ${paidTicketCount} տոմս${productNote}, ${formatAmd(order.totalAmount)}`,
          link: '/admin/tickets',
        });
        revalidatePath('/admin/notifications');
      }

      if (conflicts.length > 0) {
        const seatLabels = conflicts
          .map((c) => `${c.row}${c.number}`)
          .join(', ');

        // Ավտոմատ vPost cancel/refund՝ գումարը չմնա սառեցված/գանձված
        const cancelOrderId =
          getVPostActionOrderId(paidTx) ??
          refs.partnerOrderIds[0] ??
          order.id;
        try {
          const cancelResult = await cancelVPostPayment({
            orderID: cancelOrderId,
            amount: order.totalAmount,
          });
          paymentServerLog('vpost_auto_refund_on_conflict', {
            orderId: order.id,
            cancelOrderId,
            status: cancelResult.status,
            message: cancelResult.message,
          });
          if (cancelResult.status) {
            const conflictTicketIds = order.tickets
              .filter((t) =>
                conflicts.some(
                  (c) =>
                    t.seat &&
                    t.seat.row === c.row &&
                    t.seat.number === c.number
                )
              )
              .map((t) => t.id);
            // Եթե բոլոր տեղերը conflict էին՝ բոլոր payment-ները refunded են արդեն finalize-ում
            if (conflictTicketIds.length > 0) {
              await prisma.payment.updateMany({
                where: { ticketId: { in: conflictTicketIds } },
                data: { status: 'refunded' },
              });
            }
          }
        } catch (refundErr) {
          paymentServerLog('vpost_auto_refund_failed', {
            orderId: order.id,
            cancelOrderId,
            error:
              refundErr instanceof Error
                ? refundErr.message
                : String(refundErr),
          });
        }

        return {
          success: true,
          state: 'seat_taken' as const,
          message: `Ցավոք, ընտրված տեղ(եր)ը (${seatLabels}) այս ընթացքում զբաղվել են այլ հաճախորդի կողմից։ Վճարված գումարը կվերադարձվի։ Խնդրում ենք ընտրել այլ տեղ։`,
          conflicts,
        };
      }

      return {
        success: true,
        state: 'paid' as const,
        message: 'Վճարումը հաջողությամբ հաստատվել է',
      };
    }

    // Two-phase՝ authorized (սառեցված), բայց դեռ չգանձված — confirm-payment-ը վերևում
    // փորձվել է, բայց deposited դեռ չի դարձել։ Չենք մարկում paid, թողնում ենք pending։
    if (twoPhase && txList.some(isVPostPaymentNeedsConfirmation)) {
      paymentServerLog('vpost_sync_decision', {
        orderId: order.id,
        decision: 'pending',
        reason: 'authorized_not_deposited',
      });
      return {
        success: true,
        state: 'pending' as const,
        canRestart: false,
        message: 'Վճարումը հաստատվում է, խնդրում ենք սպասել…',
      };
    }

    const declinedTxs = txList.filter(isVPostPaymentDeclined);
    if (declinedTxs.length > 0) {
      paymentServerLog('vpost_sync_decision', {
        orderId: order.id,
        decision: 'failed',
        matchedCount: declinedTxs.length,
      });
      await markOrderAsFailed({
        id: order.id,
        tickets: order.tickets.map((t) => ({ id: t.id })),
      });

      return {
        success: true,
        state: 'failed' as const,
        canRestart: true,
        message: 'Վճարումը մերժվել է',
      };
    }

    paymentServerLog('vpost_sync_decision', {
      orderId: order.id,
      decision: 'pending',
      reason: 'no_approved_or_declined_match',
    });

    return {
      success: true,
      state: 'pending' as const,
      canRestart: true,
      message: 'Վճարումը դեռ ընթացքի մեջ է',
    };
  } catch (error: any) {
    console.error('[Sync VPost Order Status] Error:', error);
    return {
      success: false,
      error: 'Քարտային վճարման կարգավիճակը ստուգելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function createTelcellInvoiceForOrder(
  data: CreateTelcellInvoiceForOrderData
) {
  try {
    if (!data.userId || !data.orderId) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    const config = getTelcellConfig();

    if (!config.issuer || !config.secretKey) {
      return {
        success: false,
        error: 'Telcell կարգավորումները բացակայում են (.env)',
      };
    }

    // Telcell PostInvoice docs: issuer must be merchant email.
    if (!config.issuer.includes('@')) {
      paymentServerLog('telcell_config_invalid', {
        reason: 'issuer_must_be_email',
        issuerPreview: config.issuer.slice(0, 3) + '***',
      });
      return {
        success: false,
        error:
          'Telcell issuer-ը պետք է լինի email (օր. merchant@domain.com). Ստուգեք .env-ը',
      };
    }

    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        tickets: {
          include: {
            payment: true,
          },
        },
      },
    });

    if (!order) {
      return {
        success: false,
        error: 'Պատվերը չի գտնվել',
      };
    }

    if (order.userId !== data.userId) {
      return {
        success: false,
        error: 'Պատվերը ձերն չէ',
      };
    }

    const unpaidTickets = order.tickets.filter((ticket) =>
      isUnpaidHeldStatus(ticket.status)
    );

    if (unpaidTickets.length === 0) {
      if (isOrderFullyPaid(order.tickets)) {
        return {
          success: false,
          error: 'Պատվերը արդեն վճարված է',
        };
      }
      const allCancelled = order.tickets.every((t) => t.status === 'cancelled');
      if (allCancelled || order.status === 'failed') {
        return {
          success: false,
          error:
            'Վճարման ժամանակը սպառվել է։ Պատվերը չեղարկված է։ Խնդրում ենք նորից ամրագրել տեղերը։',
        };
      }
      return {
        success: false,
        error: 'Պատվերը վճարման ենթակա չէ',
      };
    }

    await upsertPendingPaymentsForOrder(data.userId, data.method, unpaidTickets);

    const product = toBase64(`GoCinema Order #${order.id}`);
    const issuerId = toBase64(`order:${order.id}`);
    const price = Math.round(order.totalAmount).toString();

    const securityCode = buildTelcellInvoiceSecurityCode({
      secretKey: config.secretKey,
      issuer: config.issuer,
      currency: config.currency,
      price,
      product,
      issuerId,
      validDays: config.validDays,
      ssn: data.ssn,
    });

    const checkout: TelcellCheckoutData = {
      url: TELCELL_INVOICE_URL,
      fields: {
        action: 'PostInvoice',
        issuer: config.issuer,
        currency: config.currency,
        price,
        product,
        issuer_id: issuerId,
        valid_days: config.validDays,
        lang: config.lang,
        security_code: securityCode,
      },
    };

    if (data.ssn) {
      checkout.fields.ssn = data.ssn;
    }

    paymentServerLog('telcell_invoice_ready', {
      orderId: order.id,
      issuer: config.issuer,
      price,
      currency: config.currency,
      validDays: config.validDays,
      fields: Object.keys(checkout.fields),
      method: data.method,
    });

    return {
      success: true,
      checkout,
      message: 'Վճարման տվյալները պատրաստ են',
    };
  } catch (error: any) {
    console.error('[Create Telcell Invoice For Order] Error:', error);
    return {
      success: false,
      error: 'Telcell վճարման հղումը ստեղծելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function getPaymentByTicketId(ticketId: number) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { ticketId },
      include: {
        ticket: {
          include: {
            screening: {
              include: {
                movie: true,
                hall: true,
              },
            },
            seat: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!payment) {
      return {
        success: false,
        error: 'Վճարումը չի գտնվել',
      };
    }

    return { success: true, payment };
  } catch (error: any) {
    console.error('[Get Payment] Error:', error);
    return {
      success: false,
      error: 'Վճարումը բեռնելիս սխալ է տեղի ունեցել',
    };
  }
}

/**
 * Բոլոր վճարումները ադմինի համար՝ բոլոր կարգավիճակներով (pending, completed,
 * failed, refunded), ֆիլմի անունով ու ցուցադրությամբ։ Քարտային վճարումների
 * համար ավելացնում է vPost-ից ստացված տվյալները (transactions/list)։
 */
export async function getAllPayments() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!isAdminRole(role)) {
      return {
        success: false,
        error: 'Իրավասությունը բավարար չէ',
        payments: [],
      };
    }

    const payments = await prisma.payment.findMany({
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
        ticket: {
          select: {
            id: true,
            status: true,
            price: true,
            orderId: true,
            screening: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                movie: {
                  select: { id: true, title: true, isActive: true },
                },
                hall: { select: { id: true, name: true } },
              },
            },
            seat: { select: { row: true, number: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, payments };
  } catch (error: any) {
    console.error('[Get All Payments] Error:', error);
    return {
      success: false,
      error: 'Վճարումները բեռնելիս սխալ է տեղի ունեցել',
      payments: [],
    };
  }
}

export type AdminVPostTransactionRow = {
  key: string;
  partnerOrderId?: number;
  actionOrderId?: number;
  itfOrderId?: number;
  customerId?: number;
  amount: number;
  fee?: number;
  totalAmount?: number;
  paymentState: string;
  responseCode?: string;
  cardNumber?: string;
  clientName?: string;
  description?: string;
  createdAt?: string;
  humandate?: string;
  vpost: VPostProviderInfo | null;
  inDatabase: boolean;
  localOrder?: {
    id: number;
    status: string;
    user?: { id: number; name: string | null; phone: string | null };
    movieTitles: string[];
    screeningLabel?: string;
    hallName?: string;
    seats: string[];
  } | null;
};

/**
 * vPost-ից բոլոր քարտային գործարքները (անկախ մեր բազայից) —
 * ջնջված/կորչած տեղային վճարումները այստեղ երևում են, եթե vPost-ում կան։
 */
export async function getAllVPostTransactionsForAdmin(options?: {
  days?: number | 'all';
}) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!isAdminRole(role)) {
      return {
        success: false,
        error: 'Իրավասությունը բավարար չէ',
        transactions: [] as AdminVPostTransactionRow[],
      };
    }

    if (!hasVPostConfig()) {
      return {
        success: false,
        error: 'Քարտային վճարման կարգավորումները բացակայում են (.env)',
        transactions: [] as AdminVPostTransactionRow[],
      };
    }

    let startDate: string | undefined;
    let endDate: string | undefined;
    const days = options?.days ?? 365;

    if (days !== 'all') {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      startDate = formatVPostDateParam(start);
      endDate = formatVPostDateParam(end);
    }

    const { transactions, paginate } = await fetchAllVPostTransactions({
      startDate,
      endDate,
    });

    const partnerOrderIds = Array.from(
      new Set(
        transactions
          .map((tx) => {
            const raw =
              getVPostTransactionPartnerOrderId(tx) ?? getVPostActionOrderId(tx);
            return resolveGoCinemaOrderIdForDisplay(raw);
          })
          .filter((id): id is number => id != null)
      )
    );

    const localOrders =
      partnerOrderIds.length > 0
        ? await prisma.order.findMany({
            where: { id: { in: partnerOrderIds } },
            select: {
              id: true,
              status: true,
              user: {
                select: { id: true, name: true, phone: true },
              },
              tickets: {
                select: {
                  seat: { select: { row: true, number: true } },
                  screening: {
                    select: {
                      startTime: true,
                      hall: { select: { name: true } },
                      movie: { select: { title: true, isActive: true } },
                    },
                  },
                },
              },
            },
          })
        : [];

    const orderMap = new Map(localOrders.map((o) => [o.id, o]));

    const rows: AdminVPostTransactionRow[] = transactions.map((tx, index) => {
      const partnerOrderId = getVPostTransactionPartnerOrderId(tx);
      const actionOrderId = getVPostActionOrderId(tx);
      const goCinemaOrderId = resolveGoCinemaOrderIdForDisplay(
        partnerOrderId ?? actionOrderId
      );
      const local = goCinemaOrderId
        ? orderMap.get(goCinemaOrderId)
        : undefined;
      const vpostInfo = buildVPostProviderInfoFromTransaction(tx);
      const resp = tx.response ?? {};
      const responseCodeRaw =
        vpostInfo?.responseCode ??
        String(
          (resp as Record<string, unknown>).ResponseCode ??
            (resp as Record<string, unknown>).responseCode ??
            ''
        );
      const responseCode = responseCodeRaw || undefined;
      const clientName = String(
        (resp as Record<string, unknown>).ClientName ?? ''
      );

      const movieTitles = local
        ? Array.from(
            new Set(
              local.tickets
                .map((t) => t.screening?.movie?.title)
                .filter((t): t is string => Boolean(t))
            )
          )
        : [];

      const firstScreening = local?.tickets[0]?.screening;
      const screeningLabel = firstScreening?.startTime
        ? new Date(firstScreening.startTime).toLocaleString('hy-AM')
        : undefined;

      return {
        key: `${tx.order?.id ?? 'x'}-${partnerOrderId ?? 'p'}-${tx.createdAt ?? index}`,
        partnerOrderId,
        actionOrderId,
        itfOrderId: tx.order?.id,
        customerId: tx.order?.customerId,
        amount: Number(tx.amount ?? tx.order?.amount ?? 0),
        fee: tx.fee ?? tx.order?.fee,
        totalAmount: tx.totalAmount ?? tx.order?.totalAmount,
        paymentState: getVPostTransactionStatus(tx),
        responseCode: responseCode || undefined,
        cardNumber: vpostInfo?.cardNumber,
        clientName: clientName || undefined,
        description: tx.description || tx.order?.description,
        createdAt: tx.createdAt,
        humandate: tx.humandate,
        vpost: vpostInfo,
        inDatabase: Boolean(local),
        localOrder: local
          ? {
              id: local.id,
              status: local.status,
              user: local.user,
              movieTitles,
              screeningLabel,
              hallName: firstScreening?.hall?.name,
              seats: local.tickets.map(
                (t) => `${t.seat?.row ?? ''}${t.seat?.number ?? ''}`
              ),
            }
          : null,
      };
    });

    return {
      success: true,
      transactions: rows,
      paginate,
      meta: {
        days: (days === 'all' ? 'all' : days) as number | 'all',
        totalFromVPost: paginate?.total ?? rows.length,
      },
    };
  } catch (error: any) {
    console.error('[Get All VPost Transactions] Error:', error);
    return {
      success: false,
      error: 'vPost գործարքները բեռնելիս սխալ է տեղի ունեցել',
      transactions: [] as AdminVPostTransactionRow[],
    };
  }
}

/** Ադմին — vPost confirm-payment (գանձել սառեցված գումարը) */
export async function confirmVPostPaymentForOrder(params: {
  orderId: number;
  customerId?: number;
  amount?: number;
}) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!isAdminRole(role)) {
      return { success: false, error: 'Իրավասությունը բավարար չէ' };
    }

    if (!hasVPostConfig()) {
      return {
        success: false,
        error: 'Քարտային վճարման կարգավորումները բացակայում են',
      };
    }

    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        userId: true,
        totalAmount: true,
        tickets: {
          select: {
            payment: { select: { transactionId: true } },
          },
        },
      },
    });

    const customerID = order
      ? String(order.userId)
      : params.customerId != null
        ? String(params.customerId)
        : null;
    const amount = order?.totalAmount ?? params.amount;

    if (!customerID || amount == null || !Number.isFinite(amount)) {
      return {
        success: false,
        error: 'Բացակայում են customerID կամ amount',
      };
    }

    const confirmResult = await confirmVPostPayment({
      orderID: params.orderId,
      customerID,
      amount,
    });

    if (
      !confirmResult.status &&
      !isApprovedResponseCode(confirmResult.data?.responseCode)
    ) {
      return {
        success: false,
        error:
          confirmResult.message ||
          'vPost confirm-payment — անհաջող պատասխան',
        provider: confirmResult.data ?? null,
      };
    }

    const itfOrderId = order
      ? parseStoredItfOrderId(order.tickets)
      : confirmResult.data?.itfOrderId
        ? parseInt(String(confirmResult.data.itfOrderId), 10)
        : undefined;
    const { list } = await fetchVPostTransactionsForOrder(
      params.orderId,
      itfOrderId
    );
    const txInfo = buildVPostProviderInfoFromTransaction(list[0]);
    const provider = mergeVPostProviderInfo(txInfo, confirmResult.data);

    return {
      success: true,
      message: 'Գումարը հաջողությամբ գանձվել է',
      provider,
      confirmResponse: confirmResult.data,
    };
  } catch (error: any) {
    console.error('[Confirm VPost Payment] Error:', error);
    return {
      success: false,
      error: 'Վճարման գանձումը ձախողվեց',
    };
  }
}

/** Ադմին — vPost cancel (վերադարձնել / ազատել սառեցված գումարը) */
export async function cancelVPostPaymentForOrder(params: {
  orderId: number;
  amount?: number;
}) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!isAdminRole(role)) {
      return { success: false, error: 'Իրավասությունը բավարար չէ' };
    }

    if (!hasVPostConfig()) {
      return {
        success: false,
        error: 'Քարտային վճարման կարգավորումները բացակայում են',
      };
    }

    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        totalAmount: true,
        tickets: {
          select: {
            id: true,
            payment: { select: { id: true, transactionId: true } },
          },
        },
      },
    });

    const amount = order?.totalAmount ?? params.amount;
    if (amount == null || !Number.isFinite(amount)) {
      return { success: false, error: 'Գործարքի գումարը բացակայում է' };
    }

    const refs = order ? parseStoredVPostRefs(order.tickets) : { partnerOrderIds: [] as number[], itfOrderIds: [] as number[] };
    const cancelOrderId = refs.partnerOrderIds[0] ?? params.orderId;

    const cancelResult = await cancelVPostPayment({
      orderID: cancelOrderId,
      amount,
    });

    if (!cancelResult.status) {
      return {
        success: false,
        error:
          cancelResult.message || 'vPost cancel — անհաջող պատասխան',
        cancelResponse: cancelResult.data ?? null,
      };
    }

    if (order) {
      const ticketIds = order.tickets.map((t) => t.id);
      if (ticketIds.length > 0) {
        await prisma.payment.updateMany({
          where: { ticketId: { in: ticketIds } },
          data: { status: 'refunded' },
        });
      }
    }

    const itfOrderId = order
      ? parseStoredItfOrderId(order.tickets)
      : cancelResult.data?.itfOrderId
        ? parseInt(String(cancelResult.data.itfOrderId), 10)
        : undefined;
    const { list } = await fetchVPostTransactionsForOrder(
      params.orderId,
      itfOrderId
    );
    const txInfo = buildVPostProviderInfoFromTransaction(list[0]);

    return {
      success: true,
      message: 'Գումարը հաջողությամբ վերադարձվել է',
      provider: txInfo,
      cancelResponse: cancelResult.data,
    };
  } catch (error: any) {
    console.error('[Cancel VPost Payment] Error:', error);
    return {
      success: false,
      error: 'Վճարման չեղարկումը ձախողվեց',
    };
  }
}
