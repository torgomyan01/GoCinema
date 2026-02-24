'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { updateTicketStatus, generateQRCode } from './tickets';

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
