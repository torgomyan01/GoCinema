'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isStaffRole } from '@/lib/roles';

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isStaffRole(user.role)) {
    return null;
  }
  return user;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const activePreparationStatuses = ['paid', 'reserved'] as const;

type ProductSummary = {
  productId: number;
  name: string;
  category: string;
  image: string | null;
  quantity: number;
};

function addSummary(
  map: Map<number, ProductSummary>,
  item: {
    productId: number;
    quantity: number;
    product: {
      name: string;
      category: string;
      image: string | null;
    };
  }
) {
  const existing = map.get(item.productId);
  if (existing) {
    existing.quantity += item.quantity;
    return;
  }
  map.set(item.productId, {
    productId: item.productId,
    name: item.product.name,
    category: item.product.category,
    image: item.product.image,
    quantity: item.quantity,
  });
}

function mapPreparationScreening(screening: any) {
  const activeTicketIds = new Set<number>(
    screening.tickets.map((ticket: any) => ticket.id)
  );
  const activeOrderIds = new Set<number>(
    screening.tickets
      .map((ticket: any) => ticket.orderId)
      .filter((id: number | null) => id !== null)
  );
  const seenSummaryItemIds = new Set<number>();
  const summaryMap = new Map<number, ProductSummary>();

  const tickets = screening.tickets.map((ticket: any) => {
    const orderItems = ticket.order?.orderItems ?? ticket.orderItems ?? [];
    const seatItems = orderItems.filter((item: any) => item.ticketId === ticket.id);
    const unassignedOrderItems = orderItems.filter(
      (item: any) => item.ticketId === null
    );

    for (const item of orderItems) {
      const belongsToScreeningTicket =
        (item.ticketId && activeTicketIds.has(item.ticketId)) ||
        (item.ticketId === null && activeOrderIds.has(item.orderId));
      if (!belongsToScreeningTicket || seenSummaryItemIds.has(item.id)) {
        continue;
      }
      seenSummaryItemIds.add(item.id);
      addSummary(summaryMap, item);
    }

    return {
      id: ticket.id,
      status: ticket.status,
      price: ticket.price,
      qrCode: ticket.qrCode,
      preparationServedAt: ticket.preparationServedAt,
      createdAt: ticket.createdAt,
      user: ticket.user,
      seat: ticket.seat,
      orderId: ticket.orderId,
      order: ticket.order
        ? {
            id: ticket.order.id,
            totalAmount: ticket.order.totalAmount,
            status: ticket.order.status,
            paymentMethod: ticket.order.paymentMethod,
          }
        : null,
      seatItems,
      unassignedOrderItems,
    };
  });

  return {
    id: screening.id,
    startTime: screening.startTime,
    endTime: screening.endTime,
    basePrice: screening.basePrice,
    movie: screening.movie,
    hall: screening.hall,
    tickets,
    productSummary: Array.from(summaryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  };
}

const preparationInclude = {
  movie: {
    select: {
      id: true,
      title: true,
      slug: true,
      image: true,
      duration: true,
    },
  },
  hall: {
    include: {
      seats: {
        orderBy: [{ row: 'asc' as const }, { number: 'asc' as const }],
        select: {
          id: true,
          row: true,
          number: true,
          seatType: true,
        },
      },
    },
  },
  tickets: {
    where: { status: { in: [...activePreparationStatuses] } },
    orderBy: [{ seat: { row: 'asc' as const } }, { seat: { number: 'asc' as const } }],
    include: {
      user: { select: { id: true, name: true, phone: true, email: true } },
      seat: { select: { id: true, row: true, number: true, seatType: true } },
      orderItems: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              image: true,
              price: true,
            },
          },
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
                  category: true,
                  image: true,
                  price: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function getPreparationScreenings() {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', screenings: [] };
  }

  try {
    const screenings = await prisma.screening.findMany({
      where: { startTime: { gte: startOfToday() } },
      orderBy: { startTime: 'asc' },
      take: 50,
      include: preparationInclude,
    });

    return {
      success: true,
      screenings: screenings.map(mapPreparationScreening),
    };
  } catch (error) {
    console.error('[Get Preparation Screenings] Error:', error);
    return {
      success: false,
      error: 'Նախապատրաստման տվյալները բեռնելիս սխալ է տեղի ունեցել',
      screenings: [],
    };
  }
}

export async function getPreparationScreening(screeningId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', screening: null };
  }

  try {
    const screening = await prisma.screening.findUnique({
      where: { id: screeningId },
      include: preparationInclude,
    });

    if (!screening) {
      return {
        success: false,
        error: 'Ցուցադրությունը չի գտնվել',
        screening: null,
      };
    }

    return {
      success: true,
      screening: mapPreparationScreening(screening),
    };
  } catch (error) {
    console.error('[Get Preparation Screening] Error:', error);
    return {
      success: false,
      error: 'Ցուցադրությունը բեռնելիս սխալ է տեղի ունեցել',
      screening: null,
    };
  }
}

export async function setTicketPreparationServed(
  ticketId: number,
  served: boolean
) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, screeningId: true },
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել' };
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { preparationServedAt: served ? new Date() : null },
      select: { id: true, preparationServedAt: true },
    });

    revalidatePath('/admin/preparation');

    return {
      success: true,
      ticket: updated,
      message: served ? 'Նշվեց որպես սպասարկված' : 'Սպասարկված նշումը հանվեց',
    };
  } catch (error) {
    console.error('[Set Ticket Preparation Served] Error:', error);
    return {
      success: false,
      error: 'Սպասարկման նշումը փոխելիս սխալ է տեղի ունեցել',
    };
  }
}
