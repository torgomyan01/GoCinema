'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface CreateTicketData {
  userId: number;
  screeningId: number;
  seatId: number;
  price: number;
}

export interface CreateMultipleTicketsData {
  userId: number;
  screeningId: number;
  seats: Array<{
    seatId: number;
    price: number;
  }>;
}

export async function getAllTicketsForAdmin() {
  try {
    const tickets = await prisma.ticket.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        screening: {
          include: {
            movie: true,
            hall: true,
          },
        },
        seat: {
          select: {
            id: true,
            row: true,
            number: true,
            seatType: true,
          },
        },
        orderItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      tickets,
    };
  } catch (error: any) {
    console.error('[Get All Tickets For Admin] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել',
      tickets: [],
    };
  }
}

export async function getUserTickets(userId: number) {
  try {
    // Validate userId
    if (!userId || isNaN(Number(userId))) {
      return {
        success: false,
        error: 'Օգտատիրոջ ID-ն վավեր չէ',
        tickets: [],
      };
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        userId: Number(userId),
      },
      include: {
        screening: {
          include: {
            movie: true,
            hall: true,
          },
        },
        seat: true,
        payment: true,
        order: {
          include: {
            orderItems: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: {
        screening: {
          startTime: 'desc',
        },
      },
    });

    return {
      success: true,
      tickets,
    };
  } catch (error: any) {
    console.error('[Get User Tickets] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել',
      tickets: [],
    };
  }
}

export async function getTicketById(id: number) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        screening: {
          include: {
            movie: true,
            hall: true,
          },
        },
        seat: true,
        payment: true,
        order: {
          include: {
            orderItems: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      return {
        success: false,
        error: 'Տոմսը չի գտնվել',
      };
    }

    return { success: true, ticket };
  } catch (error: any) {
    console.error('[Get Ticket] Error:', error);
    return {
      success: false,
      error: 'Տոմսը բեռնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function createTicket(data: CreateTicketData) {
  try {
    // Validation
    if (!data.userId || !data.screeningId || !data.seatId) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Check if seat is already taken for this screening
    const existingTicket = await prisma.ticket.findFirst({
      where: {
        screeningId: data.screeningId,
        seatId: data.seatId,
        status: {
          in: ['reserved', 'paid', 'used'],
        },
      },
    });

    if (existingTicket) {
      return {
        success: false,
        error: 'Այս նստատեղը արդեն ամրագրված է',
      };
    }

    const ticket = await prisma.ticket.create({
      data: {
        userId: data.userId,
        screeningId: data.screeningId,
        seatId: data.seatId,
        price: data.price,
        status: 'reserved',
      },
      include: {
        screening: {
          include: {
            movie: true,
            hall: true,
          },
        },
        seat: true,
      },
    });

    revalidatePath('/tickets');
    revalidatePath('/booking');

    return {
      success: true,
      ticket,
      message: 'Տոմսը հաջողությամբ ամրագրվեց',
    };
  } catch (error: any) {
    console.error('[Create Ticket] Error:', error);
    return {
      success: false,
      error: 'Տոմս ամրագրելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function createMultipleTickets(data: CreateMultipleTicketsData) {
  try {
    // Validation
    if (!data.userId || !data.screeningId || !data.seats.length) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Check if any seats are already taken
    const seatIds = data.seats.map((s) => s.seatId);
    const existingTickets = await prisma.ticket.findMany({
      where: {
        screeningId: data.screeningId,
        seatId: {
          in: seatIds,
        },
        status: {
          in: ['reserved', 'paid', 'used'],
        },
      },
    });

    if (existingTickets.length > 0) {
      return {
        success: false,
        error: 'Որոշ նստատեղեր արդեն ամրագրված են',
      };
    }

    const tickets = await prisma.ticket.createMany({
      data: data.seats.map((seat) => ({
        userId: data.userId,
        screeningId: data.screeningId,
        seatId: seat.seatId,
        price: seat.price,
        status: 'reserved',
      })),
    });

    revalidatePath('/tickets');
    revalidatePath('/booking');

    return {
      success: true,
      count: tickets.count,
      message: `${tickets.count} տոմս հաջողությամբ ամրագրվեց`,
    };
  } catch (error: any) {
    console.error('[Create Multiple Tickets] Error:', error);
    return {
      success: false,
      error: 'Տոմսեր ամրագրելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function updateTicketStatus(
  id: number,
  status: 'reserved' | 'paid' | 'used' | 'cancelled'
) {
  try {
    const ticket = await prisma.ticket.update({
      where: { id },
      data: { status },
      include: {
        screening: {
          include: {
            movie: true,
            hall: true,
          },
        },
        seat: true,
      },
    });

    revalidatePath('/tickets');
    revalidatePath('/payment');

    return {
      success: true,
      ticket,
      message: 'Տոմսի կարգավիճակը հաջողությամբ թարմացվեց',
    };
  } catch (error: any) {
    console.error('[Update Ticket Status] Error:', error);
    return {
      success: false,
      error: 'Տոմսի կարգավիճակը թարմացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function generateQRCode(ticketId: number): Promise<string> {
  try {
    // Generate QR code data (can be enhanced with encryption)
    const qrData = JSON.stringify({
      ticketId,
      timestamp: Date.now(),
    });

    // For now, return base64 encoded data
    // In production, you might want to use a QR code library like 'qrcode'
    const qrCode = Buffer.from(qrData).toString('base64');

    // Update ticket with QR code
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { qrCode },
    });

    return qrCode;
  } catch (error: any) {
    console.error('[Generate QR Code] Error:', error);
    throw new Error('QR կոդ ստեղծելիս սխալ է տեղի ունեցել');
  }
}
