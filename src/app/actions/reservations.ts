'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  occupiedTicketWhere,
  COUNTER_PAYMENT_METHOD,
  MAX_FREE_RESERVED_SEATS,
  counterHoldUntil,
  AWAITING_PAYMENT_STATUS,
  isActivePaymentHold,
} from '@/lib/reservation';
import { releaseExpiredReservations } from './tickets';
import { createNotification, formatAmd } from '@/lib/notifications';

export interface CreateCounterReservationData {
  screeningId: number;
  seatIds: number[];
  products: Array<{
    productId: number;
    quantity: number;
    seatId?: number;
  }>;
}

/**
 * Քանի՞ չվճարված դրամարկղ-ամրագրված աթոռ ունի օգտատերը։
 * Օգտագործվում է 4-աթոռ սահմանաչափը ստուգելու համար։
 */
export async function getActiveReservationCount(userId: number) {
  try {
    const count = await prisma.ticket.count({
      where: {
        userId,
        status: 'reserved',
        order: { is: { paymentMethod: COUNTER_PAYMENT_METHOD } },
      },
    });
    return { success: true, count };
  } catch (error) {
    console.error('[Get Active Reservation Count] Error:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Ստեղծում է «դրամարկղում վճարվող» ամրագրում (հետվճարային)։
 * Աթոռները պահվում են մինչև ցուցադրության սկիզբը, հաճախորդը գալիս ու
 * վճարում է դրամարկղում/մուտքի մոտ։
 */
export async function createCounterReservation(
  data: CreateCounterReservationData
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: 'Անհրաժեշտ է մուտք գործել' };
    }
    const userId = Number((session.user as { id?: string | number }).id);
    if (!userId || isNaN(userId)) {
      return { success: false, error: 'Օգտատիրոջ ID-ն վավեր չէ' };
    }

    if (!data.screeningId || !data.seatIds.length) {
      return {
        success: false,
        error: 'Բոլոր պարտադիր դաշտերը պետք է լրացված լինեն',
      };
    }

    // Արգելափակված օգտատերը չի կարող անվճար ամրագրել
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBlocked: true },
    });
    if (!user) {
      return { success: false, error: 'Օգտատերը չի գտնվել' };
    }
    if (user.isBlocked) {
      return {
        success: false,
        blocked: true,
        error:
          'Ձեր հաշիվը արգելափակված է անվճար ամրագրումից։ Խնդրում ենք գնել տոմսը օնլայն վճարմամբ։',
      };
    }

    // Legacy hook է. այլևս ավտոմատ ամրագրում չի չեղարկում։
    await releaseExpiredReservations(data.screeningId);

    // 4-աթոռ սահմանաչափ՝ ակտիվ ամրագրումներ + նոր աթոռներ
    const { count: activeCount } = await getActiveReservationCount(userId);
    if (activeCount + data.seatIds.length > MAX_FREE_RESERVED_SEATS) {
      const remaining = Math.max(0, MAX_FREE_RESERVED_SEATS - activeCount);
      return {
        success: false,
        limitReached: true,
        error:
          remaining > 0
            ? `Կարող եք անվճար ամրագրել առավելագույնը ${MAX_FREE_RESERVED_SEATS} աթոռ։ Մնացել է ${remaining} տեղ։`
            : `Դուք արդեն ունեք ${activeCount} ակտիվ ամրագրում։ Անվճար ամրագրման սահմանաչափը ${MAX_FREE_RESERVED_SEATS} աթոռ է. վճարեք կամ սպասեք ցուցադրությանը։`,
      };
    }

    const screening = await prisma.screening.findUnique({
      where: { id: data.screeningId },
      include: { movie: true, hall: true },
    });
    if (!screening) {
      return { success: false, error: 'Ցուցադրությունը չի գտնվել' };
    }

    // Ցուցադրությունը արդեն սկսվա՞ծ է
    if (new Date(screening.startTime).getTime() <= Date.now()) {
      return {
        success: false,
        error: 'Ցուցադրությունն արդեն սկսվել է, ամրագրումը հնարավոր չէ',
      };
    }

    // Տեղերի հասանելիության ստուգում
    const existingTickets = await prisma.ticket.findMany({
      where: {
        screeningId: data.screeningId,
        seatId: { in: data.seatIds },
        ...occupiedTicketWhere(),
      },
    });
    if (existingTickets.length > 0) {
      return {
        success: false,
        error: 'Որոշ նստատեղեր արդեն զբաղված են, խնդրում ենք ընտրել այլ տեղ',
      };
    }

    // Ընդհանուր գումար (տոմսեր + ապրանքներ)
    let totalAmount = data.seatIds.length * screening.basePrice;
    let productList: { id: number; price: number }[] = [];
    if (data.products.length > 0) {
      const productIds = data.products.map((p) => p.productId);
      productList = await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, price: true },
      });
      data.products.forEach((op) => {
        const product = productList.find((p) => p.id === op.productId);
        if (product) totalAmount += product.price * op.quantity;
      });
    }

    // Legacy/տեղեկատվական hold-ը պահում ենք մինչև ցուցադրության ավարտից 24 ժամ անց։
    // QR-ը և scanner սպասարկումը դրանից կախված չեն։
    const holdUntil = counterHoldUntil(screening.endTime);

    // Ստեղծում ենք տոմսերը՝ QR-ը հաճախորդի մոտ միշտ հասանելի պահելու համար։
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: 'pending',
          paymentMethod: COUNTER_PAYMENT_METHOD,
        },
      });

      const seatIdToTicketId = new Map<number, number>();
      for (const seatId of data.seatIds) {
        const ticket = await tx.ticket.create({
          data: {
            userId,
            screeningId: data.screeningId,
            seatId,
            price: screening.basePrice,
            status: 'reserved',
            holdUntil,
            orderId: order.id,
          },
        });
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { qrCode: `TICKET-${ticket.id}` },
        });
        seatIdToTicketId.set(seatId, ticket.id);
      }

      if (data.products.length > 0) {
        await tx.orderItem.createMany({
          data: data.products.map((p) => {
            const product = productList.find((prod) => prod.id === p.productId);
            const ticketId = p.seatId
              ? seatIdToTicketId.get(p.seatId)
              : null;
            return {
              orderId: order.id,
              productId: p.productId,
              quantity: p.quantity,
              price: product?.price || 0,
              ...(ticketId ? { ticketId } : {}),
            };
          }),
        });
      }

      return order;
    });

    revalidatePath('/tickets');
    revalidatePath('/booking');
    revalidatePath('/admin/scanner');

    // Ադմինի ծանուցում՝ նոր դրամարկղ-ամրագրում
    await createNotification({
      type: 'online_ticket',
      title: 'Նոր ամրագրում (վճարում դրամարկղում)',
      message: `Պատվեր #${created.id}: ${screening.movie.title} — ${data.seatIds.length} աթոռ ամրագրված է, ${formatAmd(totalAmount)} (վճարում մուտքի մոտ)`,
      link: '/admin/scanner',
    });
    revalidatePath('/admin/notifications');

    return {
      success: true,
      orderId: created.id,
      qrCode: `ORDER-${created.id}`,
      message: `${data.seatIds.length} աթոռ ամրագրվեց։ Վճարումը կկատարեք մուտքի մոտ մինչև ցուցադրության սկիզբը։`,
    };
  } catch (error) {
    console.error('[Create Counter Reservation] Error:', error);
    return {
      success: false,
      error: 'Ամրագրում ստեղծելիս սխալ է տեղի ունեցել',
    };
  }
}

/**
 * Օնլայն «սպասում է վճարման» պատվերը (5ր hold-ի ընթացքում) փոխել
 * դրամարկղ-ամրագրման՝ վճարել մուտքի մոտ։
 */
export async function convertAwaitingPaymentOrderToCounter(orderId: number) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: 'Անհրաժեշտ է մուտք գործել' };
    }
    const userId = Number((session.user as { id?: string | number }).id);
    if (!userId || isNaN(userId)) {
      return { success: false, error: 'Օգտատիրոջ ID-ն վավեր չէ' };
    }

    await releaseExpiredReservations();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: {
          include: {
            screening: { select: { endTime: true, movie: { select: { title: true } } } },
          },
        },
        user: { select: { isBlocked: true } },
      },
    });

    if (!order) {
      return { success: false, error: 'Պատվերը չի գտնվել' };
    }
    if (order.userId !== userId) {
      return { success: false, error: 'Պատվերը ձերն չէ' };
    }
    if (order.user?.isBlocked) {
      return {
        success: false,
        blocked: true,
        error:
          'Ձեր հաշիվը արգելափակված է անվճար ամրագրումից։ Խնդրում ենք վճարել օնլայն։',
      };
    }

    const awaiting = order.tickets.filter(
      (t) =>
        t.status === AWAITING_PAYMENT_STATUS &&
        isActivePaymentHold(t.holdUntil)
    );

    if (awaiting.length === 0) {
      return {
        success: false,
        error:
          'Վճարման ժամանակը լրացել է կամ տոմսեր չկան փոխարկման համար։ Ընտրեք նոր աթոռներ։',
      };
    }

    // 4-աթոռ սահմանաչափ՝ արդեն ակտիվ counter reserved + այս awaiting-ները
    const { count: activeCount } = await getActiveReservationCount(userId);
    if (activeCount + awaiting.length > MAX_FREE_RESERVED_SEATS) {
      const remaining = Math.max(0, MAX_FREE_RESERVED_SEATS - activeCount);
      return {
        success: false,
        limitReached: true,
        error:
          remaining > 0
            ? `Կարող եք անվճար ամրագրել առավելագույնը ${MAX_FREE_RESERVED_SEATS} աթոռ։ Մնացել է ${remaining} տեղ։`
            : `Անվճար ամրագրման սահմանը լրացել է (${MAX_FREE_RESERVED_SEATS} աթոռ)։`,
      };
    }

    const screeningEnd =
      awaiting[0]?.screening?.endTime ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    const holdUntil = counterHoldUntil(screeningEnd);
    const ticketIds = awaiting.map((t) => t.id);

    await prisma.$transaction(async (tx) => {
      await tx.ticket.updateMany({
        where: { id: { in: ticketIds } },
        data: {
          status: 'reserved',
          holdUntil,
        },
      });

      // QR ապահովել
      for (const t of awaiting) {
        if (!t.qrCode) {
          await tx.ticket.update({
            where: { id: t.id },
            data: { qrCode: `TICKET-${t.id}` },
          });
        }
      }

      await tx.payment.updateMany({
        where: { ticketId: { in: ticketIds }, status: 'pending' },
        data: { status: 'failed' },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: COUNTER_PAYMENT_METHOD,
          status: 'pending',
        },
      });
    });

    revalidatePath('/tickets');
    revalidatePath('/booking');
    revalidatePath('/payment');
    revalidatePath('/admin/scanner');

    const movieTitle =
      awaiting[0]?.screening?.movie?.title ?? 'ֆիլմ';
    await createNotification({
      type: 'online_ticket',
      title: 'Ամրագրում փոխարկվեց դրամարկղի',
      message: `Պատվեր #${order.id}: ${movieTitle} — ${awaiting.length} աթոռ, վճարում մուտքի մոտ`,
      link: '/admin/scanner',
    });

    return {
      success: true,
      orderId: order.id,
      message: `${awaiting.length} աթոռ ամրագրվեց դրամարկղում վճարելու համար։`,
    };
  } catch (error) {
    console.error('[Convert Awaiting To Counter] Error:', error);
    return {
      success: false,
      error: 'Փոխարկելիս սխալ է տեղի ունեցել',
    };
  }
}

