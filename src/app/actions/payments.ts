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
  hasVPostConfig,
  isVPostPaymentApproved,
  isVPostPaymentDeclined,
} from '@/lib/vpost';

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

    if (!ticket.qrCode) {
      await generateQRCode(ticket.id);
    }
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
  const issuer = process.env.TELLCELL_SHOP_ID || process.env.TELLCEL_SHOP_ID;
  const secretKey =
    process.env.TELLCELL_SHOP_KEY || process.env.TELLCEL_SHOP_KEY;
  const currency = process.env.TELLCELL_CURRENCY || 'AMD';
  const validDays = process.env.TELLCELL_VALID_DAYS || '1';
  const lang = process.env.TELLCELL_LANG || 'am';

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

    const backURL = `${appUrl}/payment/${order.id}?gateway=vpost&return=1`;
    const vpostResponse = await createVPostOrder({
      customerID: String(data.userId),
      amount: order.totalAmount,
      orderID: order.id,
      backURL,
      description: `GoCinema Order #${order.id}`,
      lang: 'hy',
    });

    if (!vpostResponse.status || !vpostResponse.data?.redirectURL) {
      return {
        success: false,
        error:
          vpostResponse.message
            ? `vPost order/new սխալ: ${vpostResponse.message}`
            : 'vPost order/new սխալ',
      };
    }

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

    const txResponse = await getVPostTransactionsByOrder(order.id);
    const txList = txResponse.data?.list || [];
    const latestTx = txList[0];

    if (!latestTx) {
      return {
        success: true,
        state: 'pending' as const,
        message: 'Վճարումը դեռ ընթացքի մեջ է',
      };
    }

    if (isVPostPaymentApproved(latestTx)) {
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

      return {
        success: true,
        state: 'paid' as const,
        message: 'Վճարումը հաջողությամբ հաստատվել է',
      };
    }

    if (isVPostPaymentDeclined(latestTx)) {
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
