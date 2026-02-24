'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { createMultipleTickets } from './tickets';

export interface CreateOrderData {
  userId: number;
  screeningId: number;
  seatIds: number[];
  products: Array<{
    productId: number;
    quantity: number;
    seatId?: number; // Optional: if provided, product belongs to specific ticket
  }>;
}

export async function createOrder(data: CreateOrderData) {
  try {
    if (!data.userId || !data.screeningId || !data.seatIds.length) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Get screening to get base price
    const screening = await prisma.screening.findUnique({
      where: { id: data.screeningId },
      include: {
        movie: true,
        hall: true,
      },
    });

    if (!screening) {
      return {
        success: false,
        error: 'Ցուցադրությունը չի գտնվել',
      };
    }

    // Calculate total amount
    let totalAmount = 0;

    // Add ticket prices
    totalAmount += data.seatIds.length * screening.basePrice;

    // Add product prices
    if (data.products.length > 0) {
      const productIds = data.products.map((p) => p.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
        },
      });

      data.products.forEach((orderProduct) => {
        const product = products.find((p) => p.id === orderProduct.productId);
        if (product) {
          totalAmount += product.price * orderProduct.quantity;
        }
      });
    }

    // Create tickets first to get ticketIds
    const ticketsResult = await createMultipleTickets({
      userId: data.userId,
      screeningId: data.screeningId,
      seats: data.seatIds.map((seatId) => ({
        seatId,
        price: screening.basePrice,
      })),
    });

    if (!ticketsResult.success) {
      return ticketsResult;
    }

    // Get created tickets and create seatId -> ticketId map
    const createdTickets = await prisma.ticket.findMany({
      where: {
        userId: data.userId,
        screeningId: data.screeningId,
        seatId: { in: data.seatIds },
        status: 'reserved',
        orderId: null,
      },
      orderBy: { createdAt: 'desc' },
      take: data.seatIds.length,
    });

    const seatIdToTicketId = new Map<number, number>();
    createdTickets.forEach((ticket) => {
      seatIdToTicketId.set(ticket.seatId, ticket.id);
    });

    // Get product prices for orderItems
    const productIds = data.products.map((p) => p.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    // Create order with orderItems (including ticketId if seatId is provided)
    const order = await prisma.order.create({
      data: {
        userId: data.userId,
        totalAmount,
        status: 'pending',
        orderItems: {
          create: data.products.map((p) => {
            const product = products.find((prod) => prod.id === p.productId);
            const ticketId = p.seatId ? seatIdToTicketId.get(p.seatId) : null;
            return {
              productId: p.productId,
              quantity: p.quantity,
              price: product?.price || 0,
              ...(ticketId && { ticketId }),
            };
          }),
        },
      },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    // Link tickets to order
    await prisma.ticket.updateMany({
      where: {
        id: { in: createdTickets.map((t) => t.id) },
      },
      data: {
        orderId: order.id,
      },
    });

    revalidatePath('/checkout');
    revalidatePath('/tickets');

    // Reload order with tickets
    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
        tickets: {
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

    return {
      success: true,
      order: updatedOrder,
      message: 'Պատվերը հաջողությամբ ստեղծվեց',
    };
  } catch (error: any) {
    console.error('[Create Order] Error:', error);
    return {
      success: false,
      error: 'Պատվեր ստեղծելիս սխալ է տեղի ունեցել',
    };
  }
}

export interface UpdateOrderProductsData {
  orderId: number;
  products: Array<{
    productId: number;
    quantity: number;
  }>;
}

export async function updateOrderProducts(data: UpdateOrderProductsData) {
  try {
    // Get existing order
    const existingOrder = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        orderItems: true,
        tickets: true,
      },
    });

    if (!existingOrder) {
      return {
        success: false,
        error: 'Պատվերը չի գտնվել',
      };
    }

    // Calculate tickets price (from existing tickets)
    const ticketsPrice = existingOrder.tickets.reduce((sum, ticket) => {
      return sum + (ticket.price || 0);
    }, 0);

    // Calculate products price
    let productsPrice = 0;
    if (data.products.length > 0) {
      const productIds = data.products.map((p) => p.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
        },
      });

      data.products.forEach((orderProduct) => {
        const product = products.find((p) => p.id === orderProduct.productId);
        if (product) {
          productsPrice += product.price * orderProduct.quantity;
        }
      });
    }

    // Calculate new total amount
    const newTotalAmount = ticketsPrice + productsPrice;

    // Delete existing order items
    await prisma.orderItem.deleteMany({
      where: { orderId: data.orderId },
    });

    // Create new order items
    if (data.products.length > 0) {
      const productIds = data.products.map((p) => p.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
        },
      });

      await prisma.orderItem.createMany({
        data: data.products.map((p) => {
          const product = products.find((prod) => prod.id === p.productId);
          return {
            orderId: data.orderId,
            productId: p.productId,
            quantity: p.quantity,
            price: product?.price || 0,
          };
        }),
      });
    }

    // Update order total amount
    await prisma.order.update({
      where: { id: data.orderId },
      data: {
        totalAmount: newTotalAmount,
      },
    });

    revalidatePath('/checkout');
    revalidatePath('/tickets');

    // Reload updated order
    const updatedOrder = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        orderItems: {
          include: {
            product: true,
          },
        },
        tickets: {
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

    return {
      success: true,
      order: updatedOrder,
      message: 'Պատվերը հաջողությամբ թարմացվեց',
    };
  } catch (error: any) {
    console.error('[Update Order Products] Error:', error);
    return {
      success: false,
      error: 'Պատվերը թարմացնելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function getOrderById(id: number) {
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        orderItems: {
          include: {
            product: true,
          },
        },
        tickets: {
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

    if (!order) {
      return {
        success: false,
        error: 'Պատվերը չի գտնվել',
      };
    }

    return { success: true, order };
  } catch (error: any) {
    console.error('[Get Order] Error:', error);
    return {
      success: false,
      error: 'Պատվերը բեռնելիս սխալ է տեղի ունեցել',
    };
  }
}
