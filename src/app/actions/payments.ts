'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { updateTicketStatus, generateQRCode } from './tickets';
import {
  TELCELL_INVOICE_URL,
  buildTelcellInvoiceSecurityCode,
  toBase64,
} from '@/lib/telcell';
import {
  createVPostOrder,
  createVPostCustomer,
  getVPostTransactionsByOrder,
  getNormalizedTransactionsFromVPostEnvelope,
  hasVPostConfig,
  isVPostPaymentApproved,
  isVPostPaymentDeclined,
  summarizeTransactionForLog,
} from '@/lib/vpost';

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

const CINEMA_ADDRESS = 'Ք․ Մարտունի, Երեվանյան 74/7';

function formatArDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('hy-AM', {
    timeZone: 'Asia/Yerevan',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function sendTelegramText(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    return data?.ok === true;
  } catch (err) {
    console.error('[Payment][Telegram] sendMessage error:', err);
    return false;
  }
}

async function sendTelegramQrPhoto(chatId: string, qrValue: string, caption: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    // Use external generator for scannable QR image.
    const photoUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrValue)}&size=360`;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return data?.ok === true;
  } catch (err) {
    console.error('[Payment][Telegram] sendPhoto error:', err);
    return false;
  }
}

async function sendVPostSuccessTelegramNotification(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          telegramChatId: true,
        },
      },
      tickets: {
        include: {
          screening: {
            include: {
              movie: { select: { title: true } },
            },
          },
          seat: {
            select: { row: true, number: true },
          },
        },
      },
    },
  });

  if (!order?.user?.telegramChatId) {
    paymentServerLog('telegram_skip', {
      orderId,
      reason: 'telegram_not_linked',
    });
    return;
  }

  const chatId = order.user.telegramChatId;
  await sendTelegramText(
    chatId,
    `🙏 Շնորհակալություն գնման համար, <b>${order.user.name || 'GoCinema'}</b>:\n\n` +
      `✅ Ձեր վճարումը հաջողությամբ հաստատվել է:\n` +
      `📍 Հասցե՝ <b>${CINEMA_ADDRESS}</b>\n\n` +
      `Խնդրում ենք մոտենալ դահլիճին ցուցադրությունից <b>15 րոպե շուտ</b>։`
  );

  for (const ticket of order.tickets) {
    const qrPayload = ticket.qrCode?.trim() || `TICKET-${ticket.id}`;
    const caption =
      `🎬 <b>${ticket.screening.movie.title}</b>\n` +
      `🕒 <b>${formatArDateTime(ticket.screening.startTime)}</b>\n` +
      `💺 Տեղ՝ <b>${ticket.seat.row}${ticket.seat.number}</b>\n` +
      `📍 ${CINEMA_ADDRESS}\n\n` +
      `🎫 Տոմսի QR կոդը ուղարկված է այս նկարով։\n` +
      `⏰ Խնդրում ենք մոտենալ ցուցադրությունից <b>15 րոպե շուտ</b>։`;

    const ok = await sendTelegramQrPhoto(chatId, qrPayload, caption);
    if (!ok) {
      await sendTelegramText(
        chatId,
        `🎫 Տոմս #${ticket.id}\n` +
          `QR կոդ՝ <code>${qrPayload}</code>\n` +
          `🎬 ${ticket.screening.movie.title}\n` +
          `🕒 ${formatArDateTime(ticket.screening.startTime)}\n` +
          `📍 ${CINEMA_ADDRESS}\n` +
          `⏰ Խնդրում ենք մոտենալ 15 րոպե շուտ։`
      );
    }
  }

  paymentServerLog('telegram_sent', {
    orderId,
    ticketCount: order.tickets.length,
    chatIdPreview: `${chatId.slice(0, 3)}***`,
  });
}

export interface CreatePaymentData {
  userId: number;
  ticketId: number;
  amount: number;
  method: 'card' | 'bank_transfer' | 'cash';
}

export async function createPayment(data: CreatePaymentData) {
  try {
    // Validation
    if (!data.userId || !data.ticketId || !data.amount) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Check if ticket exists and belongs to user
    const ticket = await prisma.ticket.findUnique({
      where: { id: data.ticketId },
      include: {
        payment: true,
      },
    });

    if (!ticket) {
      return {
        success: false,
        error: 'Տոմսը չի գտնվել',
      };
    }

    if (ticket.userId !== data.userId) {
      return {
        success: false,
        error: 'Տոմսը ձերն չէ',
      };
    }

    if (ticket.status === 'paid' || ticket.status === 'used') {
      return {
        success: false,
        error: 'Տոմսը արդեն վճարված է',
      };
    }

    // Check if payment already exists
    if (ticket.payment) {
      return {
        success: false,
        error: 'Այս տոմսի համար արդեն գոյություն ունի վճարում',
      };
    }

    // Generate transaction ID (fake for demo)
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create payment (fake payment - always succeeds)
    const payment = await prisma.payment.create({
      data: {
        userId: data.userId,
        ticketId: data.ticketId,
        amount: data.amount,
        method: data.method,
        status: 'completed', // Fake payment always succeeds
        transactionId,
      },
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
      },
    });

    // Update ticket status to 'paid'
    await updateTicketStatus(data.ticketId, 'paid');

    // Generate QR code for the ticket
    const qrCode = await generateQRCode(data.ticketId);

    revalidatePath('/tickets');
    revalidatePath('/payment');

    return {
      success: true,
      payment,
      qrCode,
      message: 'Վճարումը հաջողությամբ ավարտվեց',
    };
  } catch (error: any) {
    console.error('[Create Payment] Error:', error);
    return {
      success: false,
      error: 'Վճարում կատարելիս սխալ է տեղի ունեցել',
    };
  }
}

export interface CreatePaymentForOrderData {
  userId: number;
  orderId: number;
  method: 'card' | 'bank_transfer' | 'cash';
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

async function upsertPendingPaymentsForOrder(
  userId: number,
  method: 'card' | 'bank_transfer' | 'cash',
  tickets: Array<{
    id: number;
    price: number;
    payment: { id: number } | null;
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
          transactionId: null,
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

async function finalizeOrderAsPaid(order: {
  id: number;
  userId: number;
  tickets: Array<{
    id: number;
    price: number;
    status: string;
    qrCode: string | null;
  }>;
}) {
  for (const ticket of order.tickets) {
    await prisma.payment.upsert({
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

    if (ticket.status !== 'paid' && ticket.status !== 'used') {
      // Use direct DB update here to guarantee status transition.
      // updateTicketStatus() swallows errors by design, which is not ideal
      // for payment finalization critical path.
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'paid' },
      });
    }

    // Սկաները կարդում է TICKET-{id} — միշտ թարմացնենք վճարման հաստատման պահին
    await generateQRCode(ticket.id);
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'completed' },
  });
}

async function markOrderAsFailed(order: {
  id: number;
  tickets: Array<{ id: number }>;
}) {
  await prisma.payment.updateMany({
    where: {
      ticketId: {
        in: order.tickets.map((ticket) => ticket.id),
      },
      status: {
        not: 'completed',
      },
    },
    data: {
      status: 'failed',
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'pending' },
  });
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

    const unpaidTickets = order.tickets.filter(
      (ticket) => ticket.status !== 'paid' && ticket.status !== 'used'
    );

    if (unpaidTickets.length === 0) {
      return {
        success: false,
        error: 'Պատվերը արդեն վճարված է',
      };
    }

    await upsertPendingPaymentsForOrder(data.userId, 'card', unpaidTickets);

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
    const vpostResponse = await createVPostOrder({
      customerID: String(data.userId),
      amount: order.totalAmount,
      orderID: order.id,
      backURL,
      description: `GoCinema Order #${order.id}`,
      lang: 'hy',
    });

    if (!vpostResponse.status || !vpostResponse.data?.redirectURL) {
      paymentServerLog('vpost_order_new_failed', {
        orderId: order.id,
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
      itfOrderId: vpostResponse.data?.itfOrderId,
      partnerOrderId: vpostResponse.data?.partnerOrderId,
    });

    return {
      success: true,
      redirectURL: vpostResponse.data.redirectURL,
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
            telegramChatId: true,
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

    const txResponse = await getVPostTransactionsByOrder(order.id);
    const txList = getNormalizedTransactionsFromVPostEnvelope(txResponse);

    paymentServerLog('vpost_sync_raw', {
      orderId: order.id,
      envelopeStatus: txResponse.status,
      message: txResponse.message,
      listLength: txList.length,
      items: txList.map(summarizeTransactionForLog),
    });

    if (!txResponse.status) {
      const msg = (txResponse.message || '').toLowerCase();
      const maybeEmpty =
        msg.includes('no_payment') ||
        msg.includes('no payments') ||
        msg.includes('unregistered') ||
        msg.includes('0-100');
      if (maybeEmpty) {
        return {
          success: true,
          state: 'pending' as const,
          message: 'Վճարումը դեռ ընթացքի մեջ է',
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
        message: 'Վճարումը դեռ ընթացքի մեջ է',
      };
    }

    const approvedTxs = txList.filter(isVPostPaymentApproved);
    if (approvedTxs.length > 0) {
      const hadUnpaidTickets = order.tickets.some(
        (t) => t.status !== 'paid' && t.status !== 'used'
      );
      paymentServerLog('vpost_sync_decision', {
        orderId: order.id,
        decision: 'paid',
        matchedCount: approvedTxs.length,
      });
      await finalizeOrderAsPaid({
        id: order.id,
        userId: order.userId,
        tickets: order.tickets.map((t) => ({
          id: t.id,
          price: t.price,
          status: t.status,
          qrCode: t.qrCode,
        })),
      });

      revalidatePath('/tickets');
      revalidatePath('/payment');
      revalidatePath('/checkout');

      if (hadUnpaidTickets) {
        // Fire-and-forget: payment finalization should not fail if Telegram is unavailable.
        void sendVPostSuccessTelegramNotification(order.id).catch((err) => {
          console.error('[Payment][Telegram] vPost notify error:', err);
        });
      }

      return {
        success: true,
        state: 'paid' as const,
        message: 'Վճարումը հաջողությամբ հաստատվել է',
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

    const unpaidTickets = order.tickets.filter(
      (ticket) => ticket.status !== 'paid' && ticket.status !== 'used'
    );

    if (unpaidTickets.length === 0) {
      return {
        success: false,
        error: 'Պատվերը արդեն վճարված է',
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

export async function createPaymentForOrder(data: CreatePaymentForOrderData) {
  try {
    // Validation
    if (!data.userId || !data.orderId) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Get order with tickets
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        tickets: {
          include: {
            payment: true,
          },
        },
        orderItems: {
          include: {
            product: true,
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

    // Check if all tickets are already paid
    const unpaidTickets = order.tickets.filter(
      (ticket) => ticket.status !== 'paid' && ticket.status !== 'used'
    );

    if (unpaidTickets.length === 0) {
      return {
        success: false,
        error: 'Պատվերի բոլոր տոմսերը արդեն վճարված են',
      };
    }

    // Check if any ticket already has payment
    const ticketsWithPayment = order.tickets.filter((ticket) => ticket.payment);
    if (ticketsWithPayment.length > 0) {
      return {
        success: false,
        error: 'Որոշ տոմսեր արդեն վճարված են',
      };
    }

    // Generate transaction ID (fake for demo)
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create payment for each ticket
    const payments = [];
    const qrCodes: string[] = [];

    for (const ticket of unpaidTickets) {
      // Create payment for this ticket
      const payment = await prisma.payment.create({
        data: {
          userId: data.userId,
          ticketId: ticket.id,
          amount: ticket.price,
          method: data.method,
          status: 'completed', // Fake payment always succeeds
          transactionId: `${transactionId}-${ticket.id}`,
        },
      });

      payments.push(payment);

      // Update ticket status to 'paid'
      await updateTicketStatus(ticket.id, 'paid');

      // Generate QR code for the ticket
      const qrCode = await generateQRCode(ticket.id);
      qrCodes.push(qrCode);
    }

    revalidatePath('/tickets');
    revalidatePath('/payment');
    revalidatePath('/checkout');

    return {
      success: true,
      payments,
      qrCodes,
      tickets: unpaidTickets,
      order,
      message: `${unpaidTickets.length} տոմս հաջողությամբ վճարվեց`,
    };
  } catch (error: any) {
    console.error('[Create Payment For Order] Error:', error);
    return {
      success: false,
      error: 'Վճարում կատարելիս սխալ է տեղի ունեցել',
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
