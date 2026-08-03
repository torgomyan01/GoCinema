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
  isQuantityOnlyProduct,
  PEK_REPORTED,
  returnOrderItemStock,
  returnSingleProductUnitByQr,
  sellQuantityStock,
  sellSpecificProductUnits,
  UNIT_STOCK_INSUFFICIENT,
} from '@/lib/product-units';

const WALK_IN_PHONE = '000000000';
const WALK_IN_NAME = 'Դրամարկղ (walk-in)';

/** Չեղարկման թույլատրելի ժամկետ՝ ցուցադրության ավարտից հետո (1 ժամ) */
const CANCEL_GRACE_MS = 60 * 60 * 1000;

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
    await releaseExpiredReservations(screeningId);

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
          select: {
            seatId: true,
            status: true,
            holdUntil: true,
            userId: true,
          },
        },
      },
    });

    if (!screening) {
      return { success: false, error: 'Ցուցադրությունը չի գտնվել', data: null };
    }

    const ticketBySeat = new Map(
      screening.tickets.map((t) => [t.seatId, t] as const)
    );
    const now = new Date();

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
        seats: screening.hall.seats.map((seat) => {
          const ticket = ticketBySeat.get(seat.id);
          const isAwaiting = ticket?.status === 'awaiting_payment';
          const holdUntil =
            isAwaiting && ticket?.holdUntil
              ? ticket.holdUntil.toISOString()
              : null;
          const remainingMs =
            holdUntil != null
              ? Math.max(0, new Date(holdUntil).getTime() - now.getTime())
              : null;
          return {
            id: seat.id,
            row: seat.row,
            number: seat.number,
            seatType: seat.seatType,
            taken: Boolean(ticket),
            holdStatus: ticket?.status ?? null,
            holdUntil,
            holdRemainingMs: remainingMs,
          };
        }),
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

    // Համոզվել՝ նստատեղը ազատ է։ Reserved տոմսերը ավտոմատ չեն ազատվում։
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
        select: { id: true, name: true, price: true, costPrice: true, stock: true, category: true },
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

    const result = await prisma.$transaction(async (tx) => {
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
      let soldUnitQrCodes: string[] = [];
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
              costPrice: product.costPrice ?? 0,
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
          const soldCodes = await fulfillOrderItemStock(
            tx,
            sel.productId,
            product.category,
            Math.floor(Number(sel.quantity)),
            itemByProduct.get(sel.productId) ?? null
          );
          soldUnitQrCodes = soldUnitQrCodes.concat(soldCodes);
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

      const ticketRow = await tx.ticket.findUnique({
        where: { id: created.id },
        include: {
          screening: { include: { movie: true, hall: true } },
          seat: true,
          order: { include: { orderItems: { include: { product: true } } } },
        },
      });

      return { ticket: ticketRow, soldUnitQrCodes };
    });

    const ticket = result?.ticket ?? null;
    const soldUnitQrCodes = result?.soldUnitQrCodes ?? [];

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

    return { success: true, ticket, total: grandTotal, soldUnitQrCodes };
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

export interface CreateBoxOfficeTicketOrderData {
  screeningId: number;
  seatIds: number[];
  paymentMethod?: BoxOfficePaymentMethod;
  amountPaid?: number;
}

/**
 * Դրամարկղից մեկ կամ մի քանի աթոռ — մեկ Order, վճարված տոմսեր,
 * մուտքի QR՝ ORDER-{id} (մեկ տպում)։
 */
export async function createBoxOfficeTicketOrder(
  data: CreateBoxOfficeTicketOrderData
) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const screeningId = Number(data.screeningId);
    const seatIds = Array.from(
      new Set(
        (data.seatIds ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );

    if (!screeningId || seatIds.length === 0) {
      return { success: false, error: 'Ընտրեք առնվազն մեկ նստատեղ' };
    }

    await releaseExpiredReservations(screeningId);

    const screening = await prisma.screening.findUnique({
      where: { id: screeningId },
      include: {
        movie: { select: { title: true } },
        hall: { select: { id: true, name: true } },
      },
    });
    if (!screening) {
      return { success: false, error: 'Ցուցադրությունը չի գտնվել' };
    }

    const seats = await prisma.seat.findMany({
      where: { id: { in: seatIds }, hallId: screening.hallId },
      select: { id: true, row: true, number: true, seatType: true },
    });
    if (seats.length !== seatIds.length) {
      return { success: false, error: 'Որոշ նստատեղեր անվավեր են' };
    }

    const occupied = await prisma.ticket.findMany({
      where: {
        screeningId,
        seatId: { in: seatIds },
        ...occupiedTicketWhere(),
      },
      select: { seatId: true },
    });
    if (occupied.length > 0) {
      return {
        success: false,
        error: 'Որոշ նստատեղեր արդեն զբաղված են, թարմացրեք և կրկին փորձեք',
      };
    }

    const seatPrice = (seatType: string) =>
      seatType === 'vip'
        ? Math.round(screening.basePrice * 1.5)
        : screening.basePrice;

    const seatsWithPrice = seats.map((seat) => ({
      ...seat,
      price: seatPrice(seat.seatType),
    }));
    const grandTotal = seatsWithPrice.reduce((sum, s) => sum + s.price, 0);

    const payment = resolvePayment(
      data.paymentMethod,
      data.amountPaid,
      grandTotal
    );
    if (!payment.ok) {
      return { success: false, error: payment.error };
    }

    const walkInUserId = await getOrCreateWalkInUser();

    const result = await prisma.$transaction(
      async (tx) => {
        // Կրկնակի ստուգում transaction-ում
        const taken = await tx.ticket.findMany({
          where: {
            screeningId,
            seatId: { in: seatIds },
            ...occupiedTicketWhere(),
          },
          select: { seatId: true },
        });
        if (taken.length > 0) {
          throw new Error('SEAT_TAKEN');
        }

        const order = await tx.order.create({
          data: {
            userId: walkInUserId,
            totalAmount: grandTotal,
            status: 'completed',
            paymentMethod: payment.method,
            amountPaid: payment.amountPaid,
          },
        });

        const createdTickets: Array<{
          id: number;
          price: number;
          seat: { row: string; number: number; seatType: string };
        }> = [];

        for (const seat of seatsWithPrice) {
          const ticket = await tx.ticket.create({
            data: {
              userId: walkInUserId,
              screeningId,
              seatId: seat.id,
              price: seat.price,
              status: 'paid',
              orderId: order.id,
            },
          });
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { qrCode: `TICKET-${ticket.id}` },
          });

          await tx.payment.create({
            data: {
              userId: walkInUserId,
              ticketId: ticket.id,
              amount: seat.price,
              // Կանխիկի ամբողջ գումարը՝ առաջին տոմսի վրա (մանրի համար)
              amountPaid:
                createdTickets.length === 0
                  ? payment.amountPaid
                  : payment.method === 'cash'
                    ? seat.price
                    : seat.price,
              method: payment.method,
              status: 'completed',
              transactionId: `BOXOFFICE-ORDER-${order.id}-${ticket.id}`,
            },
          });

          createdTickets.push({
            id: ticket.id,
            price: seat.price,
            seat: {
              row: seat.row,
              number: seat.number,
              seatType: seat.seatType,
            },
          });
        }

        return {
          orderId: order.id,
          qrCode: `ORDER-${order.id}`,
          tickets: createdTickets,
          total: grandTotal,
          paymentMethod: payment.method,
          amountPaid: payment.amountPaid,
          movieTitle: screening.movie.title,
          startTime: screening.startTime,
        };
      },
      { timeout: 15000 }
    );

    const seatLabels = result.tickets
      .map((t) => `${t.seat.row}${t.seat.number}`)
      .join(', ');
    await createNotification({
      type: 'box_office',
      title: 'Դրամարկղի վաճառք (պատվեր)',
      message: `${result.movieTitle}, տեղեր ${seatLabels} — ${formatAmd(result.total)} (${payment.method === 'card' ? 'քարտով' : 'կանխիկ'})`,
      link: '/admin/tickets',
    });

    revalidatePath('/admin/box-office');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/scanner');
    revalidatePath('/admin/notifications');

    return {
      success: true as const,
      orderId: result.orderId,
      qrCode: result.qrCode,
      tickets: result.tickets,
      total: result.total,
      paymentMethod: result.paymentMethod,
      amountPaid: result.amountPaid,
      movieTitle: result.movieTitle,
      startTime: result.startTime,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'SEAT_TAKEN') {
      return {
        success: false as const,
        error: 'Որոշ նստատեղեր արդեն զբաղված են, թարմացրեք և կրկին փորձեք',
      };
    }
    console.error('[Create Box Office Ticket Order] Error:', error);
    return {
      success: false as const,
      error: 'Տոմսեր ստեղծելիս սխալ է տեղի ունեցել',
    };
  }
}

/** Տպման համար՝ դրամարկղի տոմսերի պատվեր (մեկ ORDER QR) */
export async function getBoxOfficeTicketOrderForPrint(orderId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: {
          where: { status: { not: 'cancelled' } },
          include: {
            seat: true,
            screening: { include: { movie: true, hall: true } },
            payment: true,
          },
          orderBy: [{ seat: { row: 'asc' } }, { seat: { number: 'asc' } }],
        },
      },
    });

    if (!order || order.tickets.length === 0) {
      return { success: false, error: 'Պատվերը չի գտնվել' };
    }

    const first = order.tickets[0]!;
    const payment =
      order.tickets.find((t) => t.payment)?.payment ?? null;

    return {
      success: true,
      print: {
        orderId: order.id,
        qrCode: `ORDER-${order.id}`,
        total: order.totalAmount,
        seats: order.tickets.map((t) => ({
          row: t.seat.row,
          number: t.seat.number,
          seatType: t.seat.seatType,
          price: t.price,
        })),
        screening: {
          startTime:
            typeof first.screening.startTime === 'string'
              ? first.screening.startTime
              : first.screening.startTime.toISOString(),
          movie: { title: first.screening.movie.title },
          hall: { name: first.screening.hall.name },
        },
        payment: payment
          ? {
              method: payment.method,
              amountPaid: order.amountPaid ?? payment.amountPaid ?? null,
            }
          : order.paymentMethod
            ? {
                method: order.paymentMethod,
                amountPaid: order.amountPaid ?? null,
              }
            : null,
      },
    };
  } catch (error) {
    console.error('[Get Box Office Ticket Order For Print] Error:', error);
    return { success: false, error: 'Պատվերը բեռնելիս սխալ է տեղի ունեցել' };
  }
}

export interface CreateBoxOfficeOrderData {
  /** Սկանավորված QR կոդեր (ոչ-պոպկորն ապրանքներ) */
  units?: string[];
  /** Ձեռքով քանակով ապրանքներ (պոպկորն) */
  popcorn?: BoxOfficeProductSelection[];
  paymentMethod?: BoxOfficePaymentMethod;
  amountPaid?: number;
}

/** Ինքնուրույն ապրանքների վաճառք դրամարկղից՝ առանց տոմսի (կանխիկ, QR սկանավորմամբ) */
export async function createBoxOfficeProductOrder(
  data: CreateBoxOfficeOrderData
) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const unitCodes = Array.from(
      new Set((data.units ?? []).map((c) => (c ?? '').trim()).filter(Boolean))
    );
    const popcornSelections = (data.popcorn ?? []).filter(
      (p) => p && p.productId > 0 && Number(p.quantity) > 0
    );

    if (unitCodes.length === 0 && popcornSelections.length === 0) {
      return { success: false, error: 'Ընտրեք առնվազն մեկ ապրանք' };
    }

    // QR միավորների վալիդացիա (խմբավորում ըստ ապրանքի)
    const unitsByProduct = new Map<
      number,
      { price: number; name: string; unitIds: number[] }
    >();
    let total = 0;

    if (unitCodes.length > 0) {
      const dbUnits = await prisma.productUnit.findMany({
        where: { qrCode: { in: unitCodes } },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              costPrice: true,
              category: true,
              isActive: true,
            },
          },
        },
      });
      const byCode = new Map(dbUnits.map((u) => [u.qrCode, u]));
      for (const code of unitCodes) {
        const unit = byCode.get(code);
        if (!unit) {
          return { success: false, error: `QR «${code}» չի գտնվել` };
        }
        if (isQuantityOnlyProduct(unit.product.category)) {
          return {
            success: false,
            error: `«${unit.product.name}» ապրանքը ավելացվում է քանակով, ոչ սկանավորմամբ`,
          };
        }
        if (!unit.product.isActive) {
          return { success: false, error: `«${unit.product.name}» ապրանքն ակտիվ չէ` };
        }
        if (unit.status !== 'in_stock') {
          return { success: false, error: `QR «${code}» արդեն վաճառված է` };
        }
        const group = unitsByProduct.get(unit.product.id) ?? {
          price: unit.product.price,
          costPrice: unit.product.costPrice,
          name: unit.product.name,
          unitIds: [],
        };
        group.unitIds.push(unit.id);
        unitsByProduct.set(unit.product.id, group);
        total += unit.product.price;
      }
    }

    // Պոպկորն՝ քանակով
    const popcornProducts =
      popcornSelections.length > 0
        ? await prisma.product.findMany({
            where: {
              id: { in: popcornSelections.map((s) => s.productId) },
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              price: true,
              costPrice: true,
              stock: true,
              category: true,
            },
          })
        : [];

    for (const sel of popcornSelections) {
      const product = popcornProducts.find((p) => p.id === sel.productId);
      if (!product) {
        return { success: false, error: 'Ընտրված ապրանքը հասանելի չէ' };
      }
      if (!isQuantityOnlyProduct(product.category)) {
        return {
          success: false,
          error: `«${product.name}» ապրանքը պետք է սկանավորվի QR-ով`,
        };
      }
      const qty = Math.floor(Number(sel.quantity));
      if (qty <= 0) {
        return { success: false, error: 'Անվավեր քանակ' };
      }
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

    const orderResult = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: walkInUserId,
          totalAmount: total,
          status: 'completed',
          paymentMethod: payment.method,
          amountPaid: payment.amountPaid,
        },
      });

      // QR ապրանքներ՝ մեկ պատվերի տող ամեն ապրանքի համար, կապել կոնկրետ միավորները
      const soldUnitQrCodes: string[] = [];
      for (const [productId, group] of unitsByProduct) {
        const item = await tx.orderItem.create({
          data: {
            orderId: created.id,
            productId,
            quantity: group.unitIds.length,
            price: group.price,
            costPrice: group.costPrice ?? 0,
            fulfilledAt: new Date(),
          },
        });
        const codes = await sellSpecificProductUnits(
          tx,
          group.unitIds,
          item.id
        );
        soldUnitQrCodes.push(...codes);
      }

      // Պոպկորն՝ քանակով
      for (const sel of popcornSelections) {
        const product = popcornProducts.find((p) => p.id === sel.productId)!;
        const qty = Math.floor(Number(sel.quantity));
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            productId: sel.productId,
            quantity: qty,
            price: product.price,
            costPrice: product.costPrice ?? 0,
            fulfilledAt: new Date(),
          },
        });
        await sellQuantityStock(tx, sel.productId, qty);
      }

      const orderRow = await tx.order.findUnique({
        where: { id: created.id },
        include: { orderItems: { include: { product: true } } },
      });

      return { order: orderRow, soldUnitQrCodes };
    });

    const order = orderResult?.order ?? null;
    const soldUnitQrCodes = orderResult?.soldUnitQrCodes ?? [];

    const unitCount = Array.from(unitsByProduct.values()).reduce(
      (sum, g) => sum + g.unitIds.length,
      0
    );
    const itemCount =
      unitCount +
      popcornSelections.reduce(
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

    return { success: true, order, total, soldUnitQrCodes };
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

    if (!['paid', 'reserved', 'awaiting_payment'].includes(ticket.status)) {
      return { success: false, error: 'Այս տոմսը չի կարող չեղարկվել' };
    }

    // Ցուցադրության ավարտից 1 ժամ անց տոմսը այլևս չի կարող չեղարկվել
    const screeningEnd = ticket.screening?.endTime
      ? new Date(ticket.screening.endTime)
      : null;
    if (screeningEnd) {
      const cancelDeadline = new Date(
        screeningEnd.getTime() + CANCEL_GRACE_MS
      );
      // if (Date.now() > cancelDeadline.getTime()) {
      //   return {
      //     success: false,
      //     error:
      //       'Չեղարկման ժամկետն անցել է (ցուցադրության ավարտից 1 ժամ հետո տոմսը չի չեղարկվում)',
      //   };
      // }
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
        const remainingTickets = await tx.ticket.findMany({
          where: {
            orderId: ticket.orderId,
            id: { not: ticketId },
            status: { not: 'cancelled' },
          },
          select: { id: true, status: true, price: true },
        });
        const remainingIds = remainingTickets.map((t) => t.id);
        const remainingItems =
          remainingIds.length > 0
            ? await tx.orderItem.findMany({
                where: {
                  orderId: ticket.orderId,
                  OR: [
                    { ticketId: { in: remainingIds } },
                    { ticketId: null },
                  ],
                },
                select: { price: true, quantity: true, ticketId: true },
              })
            : [];
        // Միայն մնացած տոմսերին կապված ապրանքներ (+ ընդհանուր առանց ticketId)
        const productsTotal = remainingItems
          .filter(
            (item) =>
              item.ticketId == null || remainingIds.includes(item.ticketId)
          )
          .reduce((sum, item) => sum + item.price * item.quantity, 0);
        const ticketsTotal = remainingTickets.reduce(
          (sum, t) => sum + (t.price || 0),
          0
        );
        const nextOrderStatus =
          remainingTickets.length === 0
            ? 'cancelled'
            : remainingTickets.some(
                  (t) => t.status === 'paid' || t.status === 'used'
                )
              ? 'completed'
              : 'pending';
        await tx.order.update({
          where: { id: ticket.orderId },
          data: {
            status: nextOrderStatus,
            totalAmount: ticketsTotal + productsTotal,
          },
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

    // Դրամարկղից վաճառված վճարված տոմս՝ ՀԴՄ վերադարձ միայն այս տոմսի գնով
    let returnFiscal: {
      crn: string;
      rseq: number;
      paymentMethod: 'cash' | 'card';
      amount: number;
    } | null = null;

    const wasBoxOfficeSale =
      ticket.status === 'paid' &&
      Boolean(ticket.payment?.transactionId?.startsWith('BOXOFFICE'));

    if (wasBoxOfficeSale && ticket.price > 0) {
      const alreadyReturned = await prisma.fiscalReceipt.findFirst({
        where: {
          ticketId,
          operation: 'return',
          status: 'printed',
        },
        select: { id: true },
      });

      if (!alreadyReturned) {
        const originalReceipt = await prisma.fiscalReceipt.findFirst({
          where: {
            operation: 'sale',
            status: 'printed',
            source: 'box_office',
            crn: { not: null },
            rseq: { not: null },
            OR: [
              { ticketId },
              ...(ticket.orderId ? [{ orderId: ticket.orderId }] : []),
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            crn: true,
            rseq: true,
            paymentMethod: true,
            total: true,
            orderId: true,
            ticketId: true,
          },
        });

        if (originalReceipt?.crn && originalReceipt.rseq != null) {
          // Նախորդ մասնակի վերադարձները նույն վաճառքի կտրոնից
          const priorReturns = await prisma.fiscalReceipt.findMany({
            where: {
              operation: 'return',
              status: 'printed',
              OR: [
                ...(originalReceipt.orderId
                  ? [{ orderId: originalReceipt.orderId }]
                  : []),
                ...(originalReceipt.ticketId
                  ? [{ ticketId: originalReceipt.ticketId }]
                  : []),
                { ticketId },
              ],
            },
            select: { total: true },
          });
          const alreadyReturnedSum = priorReturns.reduce(
            (sum, r) => sum + (r.total || 0),
            0
          );
          const remainingOnReceipt = Math.max(
            0,
            (originalReceipt.total || 0) - alreadyReturnedSum
          );

          // Միայն այս տոմսի գինը — ոչ ամբողջ պատվերը
          const refundAmount = Math.min(ticket.price, remainingOnReceipt);

          if (refundAmount > 0) {
            returnFiscal = {
              crn: originalReceipt.crn,
              rseq: originalReceipt.rseq,
              paymentMethod:
                originalReceipt.paymentMethod === 'card' ? 'card' : 'cash',
              amount: refundAmount,
            };
          }
        }
      }
    }

    revalidatePath('/admin/box-office');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/fiscal');
    revalidatePath('/admin/notifications');

    return {
      success: true,
      seatId: ticket.seatId,
      screeningId: ticket.screeningId,
      orderId: ticket.orderId ?? null,
      ticketId,
      returnFiscal,
    };
  } catch (error) {
    console.error('[Cancel Box Office Ticket] Error:', error);
    return {
      success: false,
      error: 'Տոմսը չեղարկելիս սխալ է տեղի ունեցել',
    };
  }
}

/** Վաճառված QR միավորի տվյալներ՝ վերադարձ/փոխանակման համար */
export async function lookupBoxOfficeReturnByQr(qrCode: string) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const code = (qrCode ?? '').trim();
  if (!code) {
    return { success: false, error: 'QR կոդը դատարկ է' };
  }

  try {
    const unit = await prisma.productUnit.findUnique({
      where: { qrCode: code },
      include: {
        product: {
          select: { id: true, name: true, price: true, category: true },
        },
        orderItem: {
          include: {
            order: {
              select: { id: true, createdAt: true, paymentMethod: true },
            },
          },
        },
      },
    });

    if (!unit) {
      return { success: false, error: 'QR կոդը բազայում չի գտնվել' };
    }

    if (isQuantityOnlyProduct(unit.product.category)) {
      return {
        success: false,
        error: 'Պոպկորնը վերադարձվում է պատվերի համարով, ոչ QR-ով',
      };
    }

    if (unit.status !== 'sold') {
      return {
        success: false,
        error:
          unit.status === 'in_stock'
            ? 'Այս միավորն դեռ չի վաճառվել'
            : 'Այս միավորի վերադարձը հնարավոր չէ',
      };
    }

    const price = unit.orderItem?.price ?? unit.product.price;

    return {
      success: true,
      item: {
        qrCode: unit.qrCode,
        productId: unit.product.id,
        productName: unit.product.name,
        price,
        orderId: unit.orderItem?.orderId ?? null,
        soldAt: unit.soldAt,
        paymentMethod: unit.orderItem?.order.paymentMethod ?? 'cash',
        pekReportedAt: unit.pekReportedAt,
      },
    };
  } catch (error) {
    console.error('[Lookup Box Office Return] Error:', error);
    return { success: false, error: 'QR-ը ստուգելիս սխալ է տեղի ունեցել' };
  }
}

export interface BoxOfficeReturnExchangeData {
  returnQrCode: string;
  mode: 'refund' | 'exchange';
  newUnits?: string[];
  newPopcorn?: BoxOfficeProductSelection[];
  paymentMethod?: BoxOfficePaymentMethod;
  amountPaid?: number;
}

/** Վերադարձ կամ փոխանակում՝ վաճառված QR ապրանքի համար */
export async function processBoxOfficeProductReturnExchange(
  data: BoxOfficeReturnExchangeData
) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const returnCode = (data.returnQrCode ?? '').trim();
  if (!returnCode) {
    return { success: false, error: 'Սկանավորեք վերադարձվող ապրանքի QR-ը' };
  }

  const newUnitCodes = Array.from(
    new Set((data.newUnits ?? []).map((c) => c.trim()).filter(Boolean))
  );
  const popcornSelections = (data.newPopcorn ?? []).filter(
    (p) => p && p.productId > 0 && Number(p.quantity) > 0
  );

  if (data.mode === 'exchange' && newUnitCodes.length === 0 && popcornSelections.length === 0) {
    return { success: false, error: 'Փոխանակման համար սկանավորեք նոր ապրանք' };
  }

  if (newUnitCodes.includes(returnCode)) {
    return {
      success: false,
      error: 'Նոր ապրանքը չի կարող լինել նույն վերադարձվող QR-ը',
    };
  }

  try {
    const walkInUserId = await getOrCreateWalkInUser();
    let refundAmount = 0;
    let returnedProductName = '';
    let originalOrderId: number | null = null;
    let newOrderId: number | null = null;
    let newTotal = 0;
    let netDue = 0;
    let soldUnitQrCodes: string[] = [];
    let exchangeSaleLines: Array<{
      name: string;
      price: number;
      qty: number;
      eMark: string | null;
    }> = [];

    await prisma.$transaction(async (tx) => {
      const returned = await returnSingleProductUnitByQr(tx, returnCode);
      if (!returned) {
        throw new Error('RETURN_NOT_FOUND');
      }

      refundAmount = returned.refundAmount;
      returnedProductName = returned.productName;
      originalOrderId = returned.orderId;

      if (data.mode === 'refund') {
        return;
      }

      const unitsByProduct = new Map<
        number,
        { price: number; name: string; unitIds: number[] }
      >();

      for (const code of newUnitCodes) {
        const unit = await tx.productUnit.findUnique({
          where: { qrCode: code },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                costPrice: true,
                category: true,
                isActive: true,
              },
            },
          },
        });
        if (!unit) {
          throw new Error(`NOT_FOUND:${code}`);
        }
        if (!unit.product.isActive) {
          throw new Error(`INACTIVE:${unit.product.name}`);
        }
        if (isQuantityOnlyProduct(unit.product.category)) {
          throw new Error(`POPCORN:${unit.product.name}`);
        }
        if (unit.status !== 'in_stock') {
          throw new Error(`SOLD:${code}`);
        }
        const group = unitsByProduct.get(unit.product.id) ?? {
          price: unit.product.price,
          costPrice: unit.product.costPrice,
          name: unit.product.name,
          unitIds: [],
        };
        group.unitIds.push(unit.id);
        unitsByProduct.set(unit.product.id, group);
        newTotal += unit.product.price;
      }

      const popcornProducts =
        popcornSelections.length > 0
          ? await tx.product.findMany({
              where: {
                id: { in: popcornSelections.map((s) => s.productId) },
                isActive: true,
              },
              select: {
                id: true,
                name: true,
                price: true,
                costPrice: true,
                stock: true,
                category: true,
              },
            })
          : [];

      for (const sel of popcornSelections) {
        const product = popcornProducts.find((p) => p.id === sel.productId);
        if (!product) {
          throw new Error('PRODUCT_UNAVAILABLE');
        }
        if (!isQuantityOnlyProduct(product.category)) {
          throw new Error(`QR_REQUIRED:${product.name}`);
        }
        const qty = Math.floor(Number(sel.quantity));
        if (qty <= 0) {
          throw new Error('INVALID_QTY');
        }
        if (product.stock < qty) {
          throw new Error(`STOCK:${product.name}:${product.stock}`);
        }
        newTotal += product.price * qty;
      }

      netDue = newTotal - refundAmount;

      let paymentMethod: BoxOfficePaymentMethod = 'cash';
      let amountPaid: number | null = null;

      if (netDue > 0) {
        const payment = resolvePayment(
          data.paymentMethod,
          data.amountPaid,
          netDue
        );
        if (!payment.ok) {
          throw new Error(`PAYMENT:${payment.error}`);
        }
        paymentMethod = payment.method;
        amountPaid = payment.amountPaid;
      }

      const created = await tx.order.create({
        data: {
          userId: walkInUserId,
          totalAmount: Math.max(0, netDue),
          status: 'completed',
          paymentMethod,
          amountPaid: netDue > 0 ? amountPaid : null,
        },
      });
      newOrderId = created.id;

      for (const [productId, group] of unitsByProduct) {
        const item = await tx.orderItem.create({
          data: {
            orderId: created.id,
            productId,
            quantity: group.unitIds.length,
            price: group.price,
            costPrice: group.costPrice ?? 0,
            fulfilledAt: new Date(),
          },
        });
        const codes = await sellSpecificProductUnits(
          tx,
          group.unitIds,
          item.id
        );
        soldUnitQrCodes.push(...codes);
        for (const code of codes) {
          exchangeSaleLines.push({
            name: group.name,
            price: group.price,
            qty: 1,
            eMark: code,
          });
        }
      }

      for (const sel of popcornSelections) {
        const product = popcornProducts.find((p) => p.id === sel.productId)!;
        const qty = Math.floor(Number(sel.quantity));
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            productId: sel.productId,
            quantity: qty,
            price: product.price,
            costPrice: product.costPrice ?? 0,
            fulfilledAt: new Date(),
          },
        });
        await sellQuantityStock(tx, sel.productId, qty);
        exchangeSaleLines.push({
          name: product.name,
          price: product.price,
          qty,
          eMark: null,
        });
      }
    });

    const refundToCustomer = netDue < 0 ? Math.abs(netDue) : refundAmount;
    const message =
      data.mode === 'refund'
        ? `Վերադարձ՝ «${returnedProductName}» (${formatAmd(refundAmount)})`
        : netDue > 0
          ? `Փոխանակում՝ «${returnedProductName}» → նոր ապրանք (${formatAmd(newTotal)}), լրացուցիչ ${formatAmd(netDue)}`
          : netDue < 0
            ? `Փոխանակում՝ «${returnedProductName}» → նոր ապրանք (${formatAmd(newTotal)}), վերադարձ հաճախորդին ${formatAmd(Math.abs(netDue))}`
            : `Փոխանակում՝ «${returnedProductName}» → նոր ապրանք (${formatAmd(newTotal)}), հավասար փոխանակում`;

    await createNotification({
      type: 'box_office',
      title:
        data.mode === 'refund'
          ? 'Դրամարկղի վերադարձ (ապրանք)'
          : 'Դրամարկղի փոխանակում (ապրանք)',
      message,
      link: '/admin/box-office',
    });

    // Գտնել սկզբնական վաճառքի ֆիսկալ կտրոնը՝ ՀԴՄ վերադարձի համար
    let returnFiscal: {
      crn: string;
      rseq: number;
      paymentMethod: 'cash' | 'card';
      eMarks: string[];
      amount: number;
    } | null = null;

    if (originalOrderId) {
      const originalReceipt = await prisma.fiscalReceipt.findFirst({
        where: {
          orderId: originalOrderId,
          operation: 'sale',
          status: 'printed',
          crn: { not: null },
          rseq: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          crn: true,
          rseq: true,
          paymentMethod: true,
        },
      });
      if (originalReceipt?.crn && originalReceipt.rseq != null) {
        returnFiscal = {
          crn: originalReceipt.crn,
          rseq: originalReceipt.rseq,
          paymentMethod:
            originalReceipt.paymentMethod === 'card' ? 'card' : 'cash',
          eMarks: [returnCode],
          amount: refundAmount,
        };
      }
    }

    revalidatePath('/admin/box-office');
    revalidatePath('/admin/products');
    revalidatePath('/admin/product-units');
    revalidatePath('/admin/notifications');

    return {
      success: true,
      mode: data.mode,
      refundAmount,
      newTotal,
      netDue,
      refundToCustomer:
        data.mode === 'refund' ? refundAmount : netDue < 0 ? Math.abs(netDue) : 0,
      orderId: newOrderId,
      soldUnitQrCodes,
      exchangeSaleLines,
      returnQrCode: returnCode,
      returnFiscal,
      message,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'RETURN_NOT_FOUND') {
        return {
          success: false,
          error: 'Վաճառված ապրանքը չի գտնվել կամ արդեն վերադարձված է',
        };
      }
      if (error.message === PEK_REPORTED) {
        return {
          success: false,
          error: 'ՊԵԿ ուղարկված միավորը չի կարելի վերադարձնել',
        };
      }
      if (error.message.startsWith('PAYMENT:')) {
        return { success: false, error: error.message.slice('PAYMENT:'.length) };
      }
      if (error.message.startsWith('SOLD:')) {
        return {
          success: false,
          error: `QR «${error.message.slice(5)}» արդեն վաճառված է`,
        };
      }
      if (error.message.startsWith('STOCK:')) {
        const [, name, stock] = error.message.split(':');
        return {
          success: false,
          error: `«${name}» ապրանքի պաշարը բավարար չէ (առկա է ${stock})`,
        };
      }
      if (error.message === 'PRODUCT_UNAVAILABLE') {
        return { success: false, error: 'Ընտրված ապրանքը հասանելի չէ' };
      }
      if (
        error.message === UNIT_STOCK_INSUFFICIENT ||
        error.message === 'STOCK_CONFLICT'
      ) {
        return {
          success: false,
          error: 'Ապրանքի պաշարը բավարար չէ, թարմացրեք էջը և կրկին փորձեք',
        };
      }
    }

    console.error('[Box Office Return/Exchange] Error:', error);
    return {
      success: false,
      error: 'Վերադարձը/փոխանակումը չստացվեց',
    };
  }
}
