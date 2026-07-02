'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isStaffRole } from '@/lib/roles';
import { occupiedTicketWhere } from '@/lib/reservation';
import { releaseExpiredReservations } from '@/app/actions/tickets';
import { createNotification, formatAmd } from '@/lib/notifications';
import {
  fulfillOrderItemStock,
  returnOrderItemStock,
  UNIT_STOCK_INSUFFICIENT,
} from '@/lib/product-units';

const WALK_IN_PHONE = '000000000';
const WALK_IN_NAME = 'Դրամարկղ (walk-in)';

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isStaffRole(user.role)) {
    return null;
  }
  return user;
}

/** Ընդհանուր «դրամարկղ» օգտատեր՝ բոլոր կանխիկ վաճառքների համար */
async function getOrCreateWalkInUser() {
  const existing = await prisma.user.findUnique({
    where: { phone: WALK_IN_PHONE },
    select: { id: true },
  });
  if (existing) return existing.id;

  const password = await bcrypt.hash(`walk-in-${Date.now()}-${Math.random()}`, 10);
  const created = await prisma.user.create({
    data: {
      name: WALK_IN_NAME,
      phone: WALK_IN_PHONE,
      password,
      role: 'user',
    },
    select: { id: true },
  });
  return created.id;
}

/** Առաջիկա ցուցադրությունները (այսօրվանից) դրամարկղի համար */
export async function getBoxOfficeScreenings() {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', screenings: [] };
  }

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const screenings = await prisma.screening.findMany({
      where: { startTime: { gte: startOfToday } },
      include: {
        movie: { select: { id: true, title: true, image: true, duration: true } },
        hall: { select: { id: true, name: true, capacity: true } },
        tickets: {
          where: occupiedTicketWhere(),
          select: { id: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const mapped = screenings.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      basePrice: s.basePrice,
      movie: s.movie,
      hall: s.hall,
      soldCount: s.tickets.length,
      capacity: s.hall.capacity,
    }));

    return { success: true, screenings: mapped };
  } catch (error) {
    console.error('[Box Office Screenings] Error:', error);
    return {
      success: false,
      error: 'Ցուցադրությունները բեռնելիս սխալ է տեղի ունեցել',
      screenings: [],
    };
  }
}

/** Դահլիճի նստատեղերի քարտեզը՝ զբաղված տեղերով */
export async function getBoxOfficeSeatMap(screeningId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  try {
    const screening = await prisma.screening.findUnique({
      where: { id: screeningId },
      include: {
        movie: { select: { id: true, title: true, duration: true } },
        hall: {
          include: {
            seats: { orderBy: [{ row: 'asc' }, { number: 'asc' }] },
          },
        },
        tickets: {
          where: occupiedTicketWhere(),
          select: { seatId: true },
        },
      },
    });

    if (!screening) {
      return { success: false, error: 'Ցուցադրությունը չի գտնվել', data: null };
    }

    const takenSeatIds = new Set(screening.tickets.map((t) => t.seatId));

    return {
      success: true,
      data: {
        id: screening.id,
        startTime: screening.startTime,
        endTime: screening.endTime,
        basePrice: screening.basePrice,
        movie: screening.movie,
        hall: {
          id: screening.hall.id,
          name: screening.hall.name,
          capacity: screening.hall.capacity,
        },
        seats: screening.hall.seats.map((seat) => ({
          id: seat.id,
          row: seat.row,
          number: seat.number,
          seatType: seat.seatType,
          taken: takenSeatIds.has(seat.id),
        })),
      },
    };
  } catch (error) {
    console.error('[Box Office Seat Map] Error:', error);
    return {
      success: false,
      error: 'Նստատեղերը բեռնելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}

/** Բերում է զբաղված նստատեղի տոմսը՝ ինֆո/վերատպելու համար */
export async function getBoxOfficeTicketBySeat(
  screeningId: number,
  seatId: number
) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', ticket: null };
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        screeningId,
        seatId,
        ...occupiedTicketWhere(),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        seat: { select: { id: true, row: true, number: true, seatType: true } },
        user: { select: { name: true, phone: true } },
        payment: { select: { method: true, status: true, amount: true } },
        screening: {
          include: {
            movie: { select: { title: true } },
            hall: { select: { name: true } },
          },
        },
      },
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել', ticket: null };
    }

    return { success: true, ticket };
  } catch (error) {
    console.error('[Box Office Ticket By Seat] Error:', error);
    return {
      success: false,
      error: 'Տոմսը բեռնելիս սխալ է տեղի ունեցել',
      ticket: null,
    };
  }
}

/** Դրամարկղում առկա ապրանքները (snacks, drinks, combos) */
export async function getBoxOfficeProducts() {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', products: [] };
  }

  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        price: true,
        category: true,
        image: true,
        stock: true,
      },
    });
    return { success: true, products };
  } catch (error) {
    console.error('[Box Office Products] Error:', error);
    return {
      success: false,
      error: 'Ապրանքները բեռնելիս սխալ է տեղի ունեցել',
      products: [],
    };
  }
}

export interface BoxOfficeProductSelection {
  productId: number;
  quantity: number;
}

export type BoxOfficePaymentMethod = 'cash' | 'card';

/**
 * Վճարման մեթոդի և կանխիկ ստացված գումարի վալիդացիա։
 * Կանխիկի դեպքում՝ ստացված գումարը չի կարող պակաս լինել ընդհանուրից։
 */
function resolvePayment(
  method: unknown,
  amountPaid: unknown,
  total: number
):
  | { ok: true; method: BoxOfficePaymentMethod; amountPaid: number | null }
  | { ok: false; error: string } {
  const paymentMethod: BoxOfficePaymentMethod = method === 'card' ? 'card' : 'cash';

  if (paymentMethod === 'card') {
    return { ok: true, method: 'card', amountPaid: total };
  }

  const received = Number(amountPaid);
  if (!Number.isFinite(received) || received < total) {
    return {
      ok: false,
      error: 'Ստացված կանխիկ գումարը չի կարող պակաս լինել ընդհանուր գումարից',
    };
  }
  return { ok: true, method: 'cash', amountPaid: received };
}

export interface CreateBoxOfficeTicketData {
  screeningId: number;
  seatId: number;
  price: number;
  products?: BoxOfficeProductSelection[];
  paymentMethod?: BoxOfficePaymentMethod;
  amountPaid?: number;
}

/** Կանխիկ վաճառք դրամարկղից՝ ստեղծում է վճարված տոմս + ապրանքներ + Payment + QR */
export async function createBoxOfficeTicket(data: CreateBoxOfficeTicketData) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const { screeningId, seatId } = data;
    const price = Number(data.price);

    if (!screeningId || !seatId || !Number.isFinite(price) || price < 0) {
      return { success: false, error: 'Բոլոր դաշտերը պետք է ճիշտ լրացված լինեն' };
    }

    // Համոզվել՝ նստատեղը ազատ է (ազատենք լրացած ամրագրումները նախ)
    await releaseExpiredReservations(screeningId);
    const existing = await prisma.ticket.findFirst({
      where: {
        screeningId,
        seatId,
        ...occupiedTicketWhere(),
      },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: 'Այս նստատեղն արդեն զբաղված է' };
    }

    // Ապրանքների վալիդացիա՝ գները միշտ բազայից (չվստահել client-ին)
    const selections = (data.products ?? []).filter(
      (p) => p && p.productId > 0 && Number(p.quantity) > 0
    );

    let productsTotal = 0;
    let dbProducts: {
      id: number;
      name: string;
      price: number;
      stock: number;
      category: string;
    }[] = [];

    if (selections.length > 0) {
      dbProducts = await prisma.product.findMany({
        where: { id: { in: selections.map((s) => s.productId) }, isActive: true },
        select: { id: true, name: true, price: true, stock: true, category: true },
      });
      for (const sel of selections) {
        const product = dbProducts.find((p) => p.id === sel.productId);
        if (!product) {
          return { success: false, error: 'Ընտրված ապրանքը հասանելի չէ' };
        }
        const qty = Math.floor(Number(sel.quantity));
        if (product.stock < qty) {
          return {
            success: false,
            error:
              product.stock <= 0
                ? `«${product.name}» ապրանքն առկա չէ`
                : `«${product.name}» ապրանքի պաշարը բավարար չէ (առկա է ${product.stock})`,
          };
        }
        productsTotal += product.price * qty;
      }
    }

    const grandTotal = price + productsTotal;

    const payment = resolvePayment(
      data.paymentMethod,
      data.amountPaid,
      grandTotal
    );
    if (!payment.ok) {
      return { success: false, error: payment.error };
    }

    const walkInUserId = await getOrCreateWalkInUser();

    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          userId: walkInUserId,
          screeningId,
          seatId,
          price,
          status: 'paid',
        },
      });

      const qrCode = `TICKET-${created.id}`;
      await tx.ticket.update({
        where: { id: created.id },
        data: { qrCode },
      });

      // Ապրանքների դեպքում՝ ստեղծել Order + OrderItem-ներ, կապել տոմսին
      if (selections.length > 0) {
        const order = await tx.order.create({
          data: {
            userId: walkInUserId,
            totalAmount: grandTotal,
            status: 'completed',
          },
        });

        await tx.orderItem.createMany({
          data: selections.map((sel) => {
            const product = dbProducts.find((p) => p.id === sel.productId)!;
            return {
              orderId: order.id,
              ticketId: created.id,
              productId: sel.productId,
              quantity: Math.floor(Number(sel.quantity)),
              price: product.price,
              fulfilledAt: new Date(),
            };
          }),
        });

        // Վաճառել ֆիզիկական միավորները (QR)՝ նշել sold, կապել պատվերի տողին
        const createdItems = await tx.orderItem.findMany({
          where: { orderId: order.id },
          select: { id: true, productId: true },
        });
        const itemByProduct = new Map(
          createdItems.map((i) => [i.productId, i.id])
        );
        for (const sel of selections) {
          const product = dbProducts.find((p) => p.id === sel.productId)!;
          await fulfillOrderItemStock(
            tx,
            sel.productId,
            product.category,
            Math.floor(Number(sel.quantity)),
            itemByProduct.get(sel.productId) ?? null
          );
        }

        await tx.ticket.update({
          where: { id: created.id },
          data: { orderId: order.id },
        });
      }

      await tx.payment.create({
        data: {
          userId: walkInUserId,
          ticketId: created.id,
          amount: grandTotal,
          amountPaid: payment.amountPaid,
          method: payment.method,
          status: 'completed',
          transactionId: `BOXOFFICE-${created.id}`,
        },
      });

      return tx.ticket.findUnique({
        where: { id: created.id },
        include: {
          screening: { include: { movie: true, hall: true } },
          seat: true,
          order: { include: { orderItems: { include: { product: true } } } },
        },
      });
    });

    const seatLabel = ticket?.seat
      ? `${ticket.seat.row}${ticket.seat.number}`
      : '';
    const movieTitle = ticket?.screening?.movie?.title ?? 'ֆիլմ';
    await createNotification({
      type: 'box_office',
      title: 'Դրամարկղի վաճառք (տոմս)',
      message: `${movieTitle}${seatLabel ? `, տեղ ${seatLabel}` : ''} — ${formatAmd(grandTotal)} (${payment.method === 'card' ? 'քարտով' : 'կանխիկ'})`,
      link: '/admin/tickets',
    });

    revalidatePath('/admin/box-office');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/notifications');

    return { success: true, ticket, total: grandTotal };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'STOCK_CONFLICT' ||
        error.message === UNIT_STOCK_INSUFFICIENT)
    ) {
      return {
        success: false,
        error: 'Ապրանքի պաշարը բավարար չէ, թարմացրեք էջը և կրկին փորձեք',
      };
    }
    console.error('[Create Box Office Ticket] Error:', error);
    return {
      success: false,
      error: 'Տոմս ստեղծելիս սխալ է տեղի ունեցել',
    };
  }
}

export interface CreateBoxOfficeOrderData {
  products: BoxOfficeProductSelection[];
  paymentMethod?: BoxOfficePaymentMethod;
  amountPaid?: number;
}

/** Ինքնուրույն ապրանքների վաճառք դրամարկղից՝ առանց տոմսի (կանխիկ) */
export async function createBoxOfficeProductOrder(
  data: CreateBoxOfficeOrderData
) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const selections = (data.products ?? []).filter(
      (p) => p && p.productId > 0 && Number(p.quantity) > 0
    );

    if (selections.length === 0) {
      return { success: false, error: 'Ընտրեք առնվազն մեկ ապրանք' };
    }

    // Գները միշտ բազայից (չվստահել client-ին)
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: selections.map((s) => s.productId) }, isActive: true },
      select: { id: true, name: true, price: true, stock: true, category: true },
    });

    let total = 0;
    for (const sel of selections) {
      const product = dbProducts.find((p) => p.id === sel.productId);
      if (!product) {
        return { success: false, error: 'Ընտրված ապրանքը հասանելի չէ' };
      }
      const qty = Math.floor(Number(sel.quantity));
      if (product.stock < qty) {
        return {
          success: false,
          error:
            product.stock <= 0
              ? `«${product.name}» ապրանքն առկա չէ`
              : `«${product.name}» ապրանքի պաշարը բավարար չէ (առկա է ${product.stock})`,
        };
      }
      total += product.price * qty;
    }

    const payment = resolvePayment(data.paymentMethod, data.amountPaid, total);
    if (!payment.ok) {
      return { success: false, error: payment.error };
    }

    const walkInUserId = await getOrCreateWalkInUser();

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: walkInUserId,
          totalAmount: total,
          status: 'completed',
          paymentMethod: payment.method,
          amountPaid: payment.amountPaid,
        },
      });

      await tx.orderItem.createMany({
        data: selections.map((sel) => {
          const product = dbProducts.find((p) => p.id === sel.productId)!;
          return {
            orderId: created.id,
            productId: sel.productId,
            quantity: Math.floor(Number(sel.quantity)),
            price: product.price,
            fulfilledAt: new Date(),
          };
        }),
      });

      // Վաճառել ֆիզիկական միավորները (QR)՝ նշել sold, կապել պատվերի տողին
      const createdItems = await tx.orderItem.findMany({
        where: { orderId: created.id },
        select: { id: true, productId: true },
      });
      const itemByProduct = new Map(
        createdItems.map((i) => [i.productId, i.id])
      );
      for (const sel of selections) {
        const product = dbProducts.find((p) => p.id === sel.productId)!;
        await fulfillOrderItemStock(
          tx,
          sel.productId,
          product.category,
          Math.floor(Number(sel.quantity)),
          itemByProduct.get(sel.productId) ?? null
        );
      }

      return tx.order.findUnique({
        where: { id: created.id },
        include: { orderItems: { include: { product: true } } },
      });
    });

    const itemCount = selections.reduce(
      (sum, sel) => sum + Math.floor(Number(sel.quantity)),
      0
    );
    await createNotification({
      type: 'box_office',
      title: 'Դրամարկղի վաճառք (ապրանք)',
      message: `${itemCount} ապրանք — ${formatAmd(total)} (${payment.method === 'card' ? 'քարտով' : 'կանխիկ'})`,
      link: '/admin/box-office',
    });

    revalidatePath('/admin/box-office');
    revalidatePath('/admin/notifications');

    return { success: true, order, total };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'STOCK_CONFLICT' ||
        error.message === UNIT_STOCK_INSUFFICIENT)
    ) {
      return {
        success: false,
        error: 'Ապրանքի պաշարը բավարար չէ, թարմացրեք էջը և կրկին փորձեք',
      };
    }
    console.error('[Create Box Office Product Order] Error:', error);
    return {
      success: false,
      error: 'Ապրանքների վաճառքը չստացվեց',
    };
  }
}

/** Բերում է ապրանքների պատվերը՝ չեկ տպելու համար */
export async function getBoxOfficeOrder(orderId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', order: null };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: { include: { product: true } } },
    });

    if (!order) {
      return { success: false, error: 'Պատվերը չի գտնվել', order: null };
    }

    return { success: true, order };
  } catch (error) {
    console.error('[Box Office Order] Error:', error);
    return {
      success: false,
      error: 'Պատվերը բեռնելիս սխալ է տեղի ունեցել',
      order: null,
    };
  }
}

/** Չեղարկել վաճառված/ամրագրված տոմսը՝ նստատեղը նորից ազատելու համար */
export async function cancelBoxOfficeTicket(ticketId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        payment: true,
        seat: { select: { id: true, row: true, number: true } },
        order: {
          include: {
            orderItems: { include: { product: { select: { category: true } } } },
          },
        },
        screening: { include: { movie: { select: { title: true } } } },
      },
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել' };
    }

    if (ticket.status === 'cancelled') {
      return { success: false, error: 'Տոմսն արդեն չեղարկված է' };
    }

    if (ticket.status === 'used') {
      return {
        success: false,
        error: 'Օգտագործված տոմսը չի կարող չեղարկվել',
      };
    }

    if (!['paid', 'reserved'].includes(ticket.status)) {
      return { success: false, error: 'Այս տոմսը չի կարող չեղարկվել' };
    }

    // Այս տոմսին կապված ապրանքների քանակները՝ պաշար վերադարձնելու համար
    const itemsToRestore = (ticket.order?.orderItems ?? []).filter(
      (item) => item.ticketId === ticketId
    );

    await prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'cancelled' },
      });

      if (ticket.payment) {
        await tx.payment.update({
          where: { id: ticket.payment.id },
          data: { status: 'refunded' },
        });
      }

      // Վերադարձնել պաշարը՝ ըստ ապրանքի տիպի (քանակ կամ QR միավոր)
      for (const item of itemsToRestore) {
        await returnOrderItemStock(
          tx,
          item.id,
          item.productId,
          item.product?.category ?? 'snack',
          item.quantity
        );
      }

      if (ticket.orderId) {
        await tx.order.update({
          where: { id: ticket.orderId },
          data: { status: 'cancelled' },
        });
      }
    });

    const cancelSeatLabel = ticket.seat
      ? `${ticket.seat.row}${ticket.seat.number}`
      : '';
    const cancelMovieTitle = ticket.screening?.movie?.title ?? 'ֆիլմ';
    await createNotification({
      type: 'cancellation',
      title: 'Տոմսի չեղարկում',
      message: `Տոմս #${ticket.id} չեղարկվեց — ${cancelMovieTitle}${cancelSeatLabel ? `, տեղ ${cancelSeatLabel}` : ''}${ticket.payment ? ' (գումարը՝ վերադարձման)' : ''}`,
      link: '/admin/tickets',
    });

    revalidatePath('/admin/box-office');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/fiscal');
    revalidatePath('/admin/notifications');

    return {
      success: true,
      seatId: ticket.seatId,
      screeningId: ticket.screeningId,
    };
  } catch (error) {
    console.error('[Cancel Box Office Ticket] Error:', error);
    return {
      success: false,
      error: 'Տոմսը չեղարկելիս սխալ է տեղի ունեցել',
    };
  }
}
