'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getOrderOrTicketByQR(qrData: string) {
  try {
    // Parse QR code data: ORDER-{id} or TICKET-{id}
    const orderMatch = qrData.match(/^ORDER-(\d+)$/);
    const ticketMatch = qrData.match(/^TICKET-(\d+)$/);

    if (orderMatch) {
      const orderId = parseInt(orderMatch[1], 10);
      const order = await prisma.order.findUnique({
        where: { id: orderId },
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
              screening: {
                include: {
                  movie: {
                    select: {
                      id: true,
                      title: true,
                      image: true,
                      duration: true,
                    },
                  },
                  hall: {
                    select: {
                      id: true,
                      name: true,
                      capacity: true,
                    },
                  },
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
                  product: {
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      category: true,
                    },
                  },
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
          data: null,
        };
      }

      return {
        success: true,
        type: 'order',
        data: order,
      };
    } else if (ticketMatch) {
      const ticketId = parseInt(ticketMatch[1], 10);
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          screening: {
            include: {
              movie: {
                select: {
                  id: true,
                  title: true,
                  image: true,
                  duration: true,
                },
              },
              hall: {
                select: {
                  id: true,
                  name: true,
                  capacity: true,
                },
              },
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
          order: {
            include: {
              orderItems: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      category: true,
                    },
                  },
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
          data: null,
        };
      }

      return {
        success: true,
        type: 'ticket',
        data: ticket,
      };
    } else {
      return {
        success: false,
        error: 'Անվավեր QR կոդ',
        data: null,
      };
    }
  } catch (error: any) {
    console.error('[Get Order/Ticket By QR] Error:', error);
    return {
      success: false,
      error: 'QR կոդը ստուգելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}

export async function markTicketAsUsed(ticketId: number) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return {
        success: false,
        error: 'Տոմսը չի գտնվել',
      };
    }

    if (ticket.status === 'used') {
      return {
        success: false,
        error: 'Տոմսը արդեն օգտագործված է',
      };
    }

    if (ticket.status !== 'paid') {
      return {
        success: false,
        error: 'Տոմսը պետք է լինի վճարված',
      };
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'used' },
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: 'Տոմսը հաջողությամբ նշվեց որպես օգտագործված',
    };
  } catch (error: any) {
    console.error('[Mark Ticket As Used] Error:', error);
    return {
      success: false,
      error: 'Տոմսը նշելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function markAllTicketsInOrderAsUsed(orderId: number) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: true,
      },
    });

    if (!order) {
      return {
        success: false,
        error: 'Պատվերը չի գտնվել',
      };
    }

    const paidTickets = order.tickets.filter((t) => t.status === 'paid');

    if (paidTickets.length === 0) {
      return {
        success: false,
        error: 'Պատվերում վճարված տոմսեր չկան',
      };
    }

    await prisma.ticket.updateMany({
      where: {
        id: {
          in: paidTickets.map((t) => t.id),
        },
        status: 'paid',
      },
      data: { status: 'used' },
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: `${paidTickets.length} տոմս հաջողությամբ նշվեց որպես օգտագործված`,
    };
  } catch (error: any) {
    console.error('[Mark All Tickets As Used] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը նշելիս սխալ է տեղի ունեցել',
    };
  }
}
