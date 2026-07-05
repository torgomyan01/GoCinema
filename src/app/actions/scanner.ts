'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';
import { COUNTER_PAYMENT_METHOD } from '@/lib/reservation';
import { createNotification, formatAmd } from '@/lib/notifications';
import {
  fulfillOrderItemStock,
  isQuantityOnlyProduct,
  sellQuantityStock,
  sellSpecificProductUnits,
  UNIT_STOCK_INSUFFICIENT,
} from '@/lib/product-units';
import type { Prisma } from '@prisma/client';

type TxClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface ScannerProductSelection {
  productId: number;
  quantity: number;
}

type ScannerPaymentMethod = 'cash' | 'card';

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isStaffRole(user.role)) {
    return null;
  }
  return user;
}

const ORDER_INCLUDE = {
  user: {
    select: { id: true, name: true, phone: true, email: true },
  },
  tickets: {
    include: {
      screening: {
        include: {
          movie: {
            select: { id: true, title: true, image: true, duration: true },
          },
          hall: { select: { id: true, name: true, capacity: true } },
        },
      },
      seat: {
        select: { id: true, row: true, number: true, seatType: true },
      },
      orderItems: {
        include: {
          product: {
            select: { id: true, name: true, price: true, category: true },
          },
        },
      },
    },
  },
} as const;

const TICKET_INCLUDE = {
  user: { select: { id: true, name: true, phone: true, email: true } },
  screening: {
    include: {
      movie: {
        select: { id: true, title: true, image: true, duration: true },
      },
      hall: { select: { id: true, name: true, capacity: true } },
    },
  },
  seat: { select: { id: true, row: true, number: true, seatType: true } },
  orderItems: {
    include: {
      product: {
        select: { id: true, name: true, price: true, category: true },
      },
    },
  },
  order: {
    include: {
      orderItems: {
        include: {
          product: {
            select: { id: true, name: true, price: true, category: true },
          },
        },
      },
    },
  },
} as const;

function resolveScannerPayment(
  method: unknown,
  amountPaid: unknown,
  total: number
):
  | { ok: true; method: ScannerPaymentMethod; amountPaid: number | null }
  | { ok: false; error: string } {
  const paymentMethod: ScannerPaymentMethod = method === 'card' ? 'card' : 'cash';

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

async function fulfillTicketProducts(tx: TxClient, ticketId: number) {
  const items = await tx.orderItem.findMany({
    where: { ticketId, fulfilledAt: null },
    include: { product: { select: { id: true, name: true, category: true } } },
  });

  for (const item of items) {
    try {
      await fulfillOrderItemStock(
        tx,
        item.productId,
        item.product.category,
        item.quantity,
        item.id
      );
    } catch (error) {
      if (error instanceof Error && error.message === UNIT_STOCK_INSUFFICIENT) {
        throw new Error(`STOCK_INSUFFICIENT:${item.product.name}`);
      }
      throw error;
    }
    await tx.orderItem.update({
      where: { id: item.id },
      data: { fulfilledAt: new Date() },
    });
  }
}

function mapStockError(error: unknown): string | null {
  if (error instanceof Error && error.message.startsWith('STOCK_INSUFFICIENT:')) {
    const name = error.message.slice('STOCK_INSUFFICIENT:'.length);
    return `«${name}» ապրանքի պաշարը բավարար չէ մուտքի համար`;
  }
  return null;
}

/**
 * Նորմալիզացնում է սկանավորված/մուտքագրված տվյալը։
 * Բարկոդ-սկաները հաճախ ավելացնում է whitespace/նոր տող, կամ QR-ը կարող է լինել
 * share-հղում (`.../ticket/share?code=TICKET-12`)։ Հանում ենք ORDER-N / TICKET-N
 * կաղապարը ցանկացած ֆորմատից։
 */
function normalizeScanInput(raw: string): {
  type: 'order' | 'ticket' | null;
  id: number | null;
} {
  if (!raw) return { type: null, id: null };
  const text = decodeURIComponent(raw.trim()).toUpperCase();

  const orderMatch = text.match(/ORDER[-\s_]?(\d+)/);
  if (orderMatch) return { type: 'order', id: parseInt(orderMatch[1], 10) };

  const ticketMatch = text.match(/TICKET[-\s_]?(\d+)/);
  if (ticketMatch) return { type: 'ticket', id: parseInt(ticketMatch[1], 10) };

  // Միայն թիվ (օր.՝ «123») — դիտարկում ենք որպես պատվերի համար
  const bareNumber = text.match(/^#?(\d+)$/);
  if (bareNumber) return { type: 'order', id: parseInt(bareNumber[1], 10) };

  return { type: null, id: null };
}

async function fetchOrderData(orderId: number) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
}

export async function getOrderOrTicketByQR(qrData: string) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  try {
    const { type, id } = normalizeScanInput(qrData);

    if (!type || id === null || isNaN(id)) {
      return {
        success: false,
        error: 'Անվավեր QR կոդ',
        data: null,
      };
    }

    if (type === 'order') {
      const order = await fetchOrderData(id);
      if (!order) {
        return { success: false, error: 'Պատվերը չի գտնվել', data: null };
      }
      return { success: true, type: 'order', data: order };
    }

    // type === 'ticket'
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: TICKET_INCLUDE,
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել', data: null };
    }

    // Եթե տոմսը պատկանում է պատվերի՝ վերադարձնում ենք ամբողջ պատվերը, որպեսզի
    // TICKET-{id} և ORDER-{id} սկանավորումը տան նույն արդյունքը (բոլոր տոմսերը,
    // վճարման պանելը ամրագրումների համար, «նշել որպես օգտագործված» և այլն)։
    if (ticket.orderId) {
      const order = await fetchOrderData(ticket.orderId);
      if (order) {
        return { success: true, type: 'order', data: order };
      }
    }

    return { success: true, type: 'ticket', data: ticket };
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
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

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

    await prisma.$transaction(async (tx) => {
      await fulfillTicketProducts(tx, ticketId);
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'used' },
      });
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: 'Տոմսը հաջողությամբ նշվեց որպես օգտագործված',
    };
  } catch (error: unknown) {
    const stockError = mapStockError(error);
    if (stockError) {
      return { success: false, error: stockError };
    }
    console.error('[Mark Ticket As Used] Error:', error);
    return {
      success: false,
      error: 'Տոմսը նշելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function markAllTicketsInOrderAsUsed(orderId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

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

    await prisma.$transaction(async (tx) => {
      for (const t of paidTickets) {
        await fulfillTicketProducts(tx, t.id);
      }
      await tx.ticket.updateMany({
        where: {
          id: { in: paidTickets.map((t) => t.id) },
          status: 'paid',
        },
        data: { status: 'used' },
      });
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: `${paidTickets.length} տոմս հաջողությամբ նշվեց որպես օգտագործված`,
    };
  } catch (error: unknown) {
    const stockError = mapStockError(error);
    if (stockError) {
      return { success: false, error: stockError };
    }
    console.error('[Mark All Tickets As Used] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը նշելիս սխալ է տեղի ունեցել',
    };
  }
}

/**
 * Որոնում է չվճարված ամրագրումներ (դրամարկղում վճարվող)՝ ըստ պատվերի համարի
 * կամ հաճախորդի հեռախոսահամարի։ Օգտագործվում է մուտքի էջում, երբ հաճախորդը
 * չունի QR կամ չի կարող սկանավորել։
 */
export async function findReservations(query: string) {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return { success: false, error: 'Իրավասությունը բավարար չէ', results: [] };
    }

    const q = (query || '').trim();
    if (!q) {
      return { success: false, error: 'Մուտքագրեք որոնման տվյալ', results: [] };
    }

    const where: any = {
      paymentMethod: COUNTER_PAYMENT_METHOD,
      tickets: { some: { status: 'reserved' } },
    };

    // ORDER-N / TICKET-N / մաքուր թիվ → ըստ պատվերի, հակառակ դեպքում՝ ըստ
    // հեռախոսի կամ անվան
    const upper = q.toUpperCase();
    const ticketMatch = upper.match(/TICKET[-\s_]?(\d+)/);
    const orderMatch =
      upper.match(/ORDER[-\s_]?(\d+)/) || q.match(/^#?(\d+)$/);

    if (ticketMatch) {
      const ticket = await prisma.ticket.findUnique({
        where: { id: parseInt(ticketMatch[1], 10) },
        select: { orderId: true },
      });
      where.id = ticket?.orderId ?? -1;
    } else if (orderMatch) {
      where.id = parseInt(orderMatch[1], 10);
    } else {
      const phoneDigits = q.replace(/\D/g, '');
      where.user = {
        is: {
          OR: [
            { phone: { contains: phoneDigits || q } },
            { name: { contains: q } },
          ],
        },
      };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, isBlocked: true } },
        tickets: {
          include: {
            seat: { select: { row: true, number: true } },
            screening: {
              include: { movie: { select: { title: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const results = orders.map((order) => {
      const reserved = order.tickets.filter((t) => t.status === 'reserved');
      const firstScreening = order.tickets[0]?.screening;
      return {
        orderId: order.id,
        qrCode: `ORDER-${order.id}`,
        userName: order.user?.name || null,
        userPhone: order.user?.phone || null,
        isBlocked: order.user?.isBlocked || false,
        movieTitle: firstScreening?.movie?.title || null,
        startTime: firstScreening?.startTime || null,
        seatCount: order.tickets.length,
        reservedCount: reserved.length,
        totalAmount: order.totalAmount,
        status: order.status,
      };
    });

    return { success: true, results };
  } catch (error: any) {
    console.error('[Find Reservations] Error:', error);
    return {
      success: false,
      error: 'Որոնելիս սխալ է տեղի ունեցել',
      results: [],
    };
  }
}

/**
 * Ընդունում է չվճարված ամրագրման վճարումը դրամարկղում/մուտքի մոտ։
 * Բոլոր reserved տոմսերը դառնում են «paid», ստեղծվում են Payment գրառումներ
 * (status: completed)՝ եկամուտը դրամարկղում հաշվելու համար։ Դրանից հետո
 * տոմսերը կարող են նշվել որպես «օգտագործված» (մուտք)։
 */
export async function payReservationAtCounter(input: {
  orderId: number;
  method: 'cash' | 'card';
  amountPaid?: number;
}) {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return { success: false, error: 'Իրավասությունը բավարար չէ' };
    }

    const { orderId } = input;
    const method: 'cash' | 'card' = input.method === 'card' ? 'card' : 'cash';

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: true,
        orderItems: true,
        user: { select: { id: true } },
      },
    });

    if (!order) {
      return { success: false, error: 'Պատվերը չի գտնվել' };
    }

    const reservedTickets = order.tickets.filter(
      (t) => t.status === 'reserved'
    );
    if (reservedTickets.length === 0) {
      return {
        success: false,
        error: 'Այս պատվերում չվճարված ամրագրված տոմսեր չկան',
      };
    }

    const ticketsTotal = reservedTickets.reduce(
      (sum, t) => sum + (t.price || 0),
      0
    );
    const productsTotal = order.orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const grandTotal = ticketsTotal + productsTotal;

    let amountPaid: number | null = grandTotal;
    if (method === 'cash') {
      const received = Number(input.amountPaid);
      if (!Number.isFinite(received) || received < grandTotal) {
        return {
          success: false,
          error: 'Ստացված կանխիկ գումարը չի կարող պակաս լինել ընդհանուր գումարից',
        };
      }
      amountPaid = received;
    }

    await prisma.$transaction(async (tx) => {
      for (const ticket of reservedTickets) {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: 'paid',
            qrCode: ticket.qrCode || `TICKET-${ticket.id}`,
          },
        });

        // Payment գրառում՝ եկամուտի համար (եթե արդեն չկա)
        const existing = await tx.payment.findUnique({
          where: { ticketId: ticket.id },
        });
        if (existing) {
          await tx.payment.update({
            where: { ticketId: ticket.id },
            data: {
              amount: ticket.price,
              method,
              status: 'completed',
              transactionId: `COUNTER-${order.id}-${ticket.id}`,
            },
          });
        } else {
          await tx.payment.create({
            data: {
              userId: ticket.userId,
              ticketId: ticket.id,
              amount: ticket.price,
              method,
              status: 'completed',
              transactionId: `COUNTER-${order.id}-${ticket.id}`,
            },
          });
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          paymentMethod: method,
          amountPaid,
        },
      });
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');
    revalidatePath('/tickets');

    await createNotification({
      type: 'box_office',
      title: 'Դրամարկղ՝ ամրագրման վճարում',
      message: `Պատվեր #${order.id}: ${reservedTickets.length} ամրագրված տոմս վճարվեց (${method === 'cash' ? 'կանխիկ' : 'քարտ'}), ${formatAmd(grandTotal)}`,
      link: '/admin/scanner',
    });
    revalidatePath('/admin/notifications');

    return {
      success: true,
      total: grandTotal,
      amountPaid,
      change: method === 'cash' ? (amountPaid as number) - grandTotal : 0,
      paidCount: reservedTickets.length,
      message: `${reservedTickets.length} տոմս վճարվեց դրամարկղում`,
    };
  } catch (error: any) {
    console.error('[Pay Reservation At Counter] Error:', error);
    return {
      success: false,
      error: 'Վճարումը մշակելիս սխալ է տեղի ունեցել',
    };
  }
}

export interface TicketProductScanInput {
  ticketId: number;
  /** Սկանավորված QR կոդեր (ոչ-պոպկորն ապրանքներ) */
  units?: string[];
  /** Ձեռքով քանակով ապրանքներ (պոպկորն) */
  popcorn?: ScannerProductSelection[];
  paymentMethod?: ScannerPaymentMethod;
  amountPaid?: number;
}

/**
 * Տոմսին ապրանք ավելացնել՝ QR սկանավորմամբ (ոչ-պոպկորն) և/կամ պոպկորն քանակով։
 *
 * - Վճարված (`paid`) տոմս՝ ապրանքները վաճառվում են անմիջապես (պահանջվում է վճարում)։
 * - Չվճարված (`reserved`) տոմս՝ ապրանքներն ավելանում են պատվերին, գումարը միանում է
 *   տոմսի հետ և վճարվում է դրամարկղում միասին (առանձին վճարում չի պահանջվում)։
 *
 * Սկանավորված միավորները անմիջապես նշվում են `sold` և կապվում պատվերի տողին։
 */
export async function addTicketProducts(data: TicketProductScanInput) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const ticketId = Number(data.ticketId);
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      return { success: false, error: 'Անվավեր տոմս' };
    }

    const unitCodes = Array.from(
      new Set((data.units ?? []).map((c) => (c ?? '').trim()).filter(Boolean))
    );
    const popcornSelections = (data.popcorn ?? []).filter(
      (p) => p && p.productId > 0 && Number(p.quantity) > 0
    );

    if (unitCodes.length === 0 && popcornSelections.length === 0) {
      return { success: false, error: 'Ընտրեք առնվազն մեկ ապրանք' };
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        seat: { select: { row: true, number: true } },
        screening: { include: { movie: { select: { title: true } } } },
      },
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել' };
    }
    if (ticket.status === 'used') {
      return { success: false, error: 'Տոմսը արդեն մուտք է գործել' };
    }
    if (ticket.status === 'cancelled') {
      return { success: false, error: 'Չեղարկված տոմսին ապրանք չի ավելացվում' };
    }
    const isPaidMode = ticket.status === 'paid';

    // QR միավորների վալիդացիա (խմբավորում ըստ ապրանքի)
    const unitsByProduct = new Map<
      number,
      { price: number; name: string; unitIds: number[] }
    >();
    let productsTotal = 0;

    if (unitCodes.length > 0) {
      const dbUnits = await prisma.productUnit.findMany({
        where: { qrCode: { in: unitCodes } },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
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
          return {
            success: false,
            error: `QR «${code}» արդեն վաճառված է`,
          };
        }

        const group = unitsByProduct.get(unit.product.id) ?? {
          price: unit.product.price,
          name: unit.product.name,
          unitIds: [],
        };
        group.unitIds.push(unit.id);
        unitsByProduct.set(unit.product.id, group);
        productsTotal += unit.product.price;
      }
    }

    // Պոպկորն (քանակ)
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
      productsTotal += product.price * qty;
    }

    // Վճարումը պահանջվում է միայն վճարված տոմսի դեպքում (անմիջապես վաճառք)
    let payment: {
      ok: true;
      method: ScannerPaymentMethod;
      amountPaid: number | null;
    } | null = null;
    if (isPaidMode) {
      const resolved = resolveScannerPayment(
        data.paymentMethod,
        data.amountPaid,
        productsTotal
      );
      if (!resolved.ok) {
        return { success: false, error: resolved.error };
      }
      payment = resolved;
    }

    await prisma.$transaction(async (tx) => {
      let orderId = ticket.orderId;

      if (!orderId) {
        const order = await tx.order.create({
          data: {
            userId: ticket.userId,
            totalAmount: productsTotal,
            status: isPaidMode ? 'completed' : 'pending',
            ...(isPaidMode && payment
              ? {
                  paymentMethod: payment.method,
                  amountPaid: payment.amountPaid,
                }
              : {}),
          },
        });
        orderId = order.id;
        await tx.ticket.update({
          where: { id: ticketId },
          data: { orderId },
        });
      } else {
        await tx.order.update({
          where: { id: orderId },
          data: {
            totalAmount: { increment: productsTotal },
            ...(isPaidMode ? { status: 'completed' } : {}),
          },
        });
      }

      // QR ապրանքներ՝ մեկ պատվերի տող ամեն ապրանքի համար, կապել կոնկրետ միավորները
      for (const [productId, group] of unitsByProduct) {
        const item = await tx.orderItem.create({
          data: {
            orderId,
            ticketId,
            productId,
            quantity: group.unitIds.length,
            price: group.price,
            fulfilledAt: new Date(),
          },
        });
        await sellSpecificProductUnits(tx, group.unitIds, item.id);
      }

      // Պոպկորն՝ քանակով
      for (const sel of popcornSelections) {
        const product = popcornProducts.find((p) => p.id === sel.productId)!;
        const qty = Math.floor(Number(sel.quantity));
        await tx.orderItem.create({
          data: {
            orderId,
            ticketId,
            productId: sel.productId,
            quantity: qty,
            price: product.price,
            fulfilledAt: new Date(),
          },
        });
        await sellQuantityStock(tx, sel.productId, qty);
      }
    });

    const seatLabel = ticket.seat
      ? `${ticket.seat.row}${ticket.seat.number}`
      : '';
    const movieTitle = ticket.screening?.movie?.title ?? 'ֆիլմ';
    const paymentNote = isPaidMode
      ? ` (${payment?.method === 'card' ? 'քարտով' : 'կանխիկ'})`
      : ' (ավելացվեց պատվերին)';

    await createNotification({
      type: 'box_office',
      title: 'Մուտքի կետ՝ ապրանքների վաճառք',
      message: `${movieTitle}${seatLabel ? `, տեղ ${seatLabel}` : ''} — ${formatAmd(productsTotal)}${paymentNote}`,
      link: '/admin/scanner',
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/notifications');

    return {
      success: true,
      total: productsTotal,
      paid: isPaidMode,
      message: isPaidMode
        ? 'Ապրանքները վաճառվեցին տոմսին'
        : 'Ապրանքներն ավելացվեցին պատվերին (վճարումը՝ դրամարկղում)',
    };
  } catch (error: unknown) {
    const stockError = mapStockError(error);
    if (stockError) {
      return { success: false, error: stockError };
    }
    if (error instanceof Error && error.message === UNIT_STOCK_INSUFFICIENT) {
      return {
        success: false,
        error: 'Ապրանքի պաշարը բավարար չէ (միավորն արդեն վաճառված է)',
      };
    }
    console.error('[Add Ticket Products] Error:', error);
    return {
      success: false,
      error: 'Ապրանքները ավելացնելիս սխալ է տեղի ունեցել',
    };
  }
}
