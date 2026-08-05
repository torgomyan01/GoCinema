'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';
import {
  COUNTER_PAYMENT_METHOD,
  isUnpaidHeldStatus,
} from '@/lib/reservation';
import { createNotification, formatAmd } from '@/lib/notifications';
import { awardBonusForSale } from '@/lib/bonus';
import {
  isQuantityOnlyProduct,
  QUANTITY_ONLY_CATEGORIES,
  reserveProductUnitsForOrderItem,
  clearOrderItemQrReservations,
  returnOrderItemStock,
  sellQuantityStock,
  sellReservedProductUnits,
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
          units: {
            select: {
              id: true,
              qrCode: true,
              status: true,
              productId: true,
            },
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
      units: {
        select: {
          id: true,
          qrCode: true,
          status: true,
          productId: true,
        },
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
          units: {
            select: {
              id: true,
              qrCode: true,
              status: true,
              productId: true,
            },
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

const PREORDER_QR_INCOMPLETE = 'PREORDER_QR_INCOMPLETE';

type EntryFiscalLine = {
  name: string;
  price: number;
  qty: number;
  eMark?: string | null;
  isTicket?: boolean;
};

function mapPreOrderQrError(error: unknown): string | null {
  if (error instanceof Error) {
    if (error.message === PREORDER_QR_INCOMPLETE) {
      return 'Բոլոր ամրագրված ապրանքների QR-ները պետք է սկանավորված լինեն մուտքից առաջ';
    }
    if (error.message.startsWith('PREORDER_QR_ITEM:')) {
      const name = error.message.slice('PREORDER_QR_ITEM:'.length);
      return `«${name}» ապրանքի համար սկանավորեք բոլոր QR-ները`;
    }
  }
  return null;
}

async function fulfillTicketProducts(
  tx: TxClient,
  ticketId: number,
  fiscalLines: EntryFiscalLine[]
) {
  const items = await tx.orderItem.findMany({
    where: { ticketId, fulfilledAt: null },
    include: {
      product: { select: { id: true, name: true, category: true } },
      units: {
        where: { status: 'in_stock' },
        select: { id: true, qrCode: true },
      },
    },
  });

  for (const item of items) {
    if (isQuantityOnlyProduct(item.product.category)) {
      try {
        await sellQuantityStock(tx, item.productId, item.quantity);
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
      continue;
    }

    const reserved = item.units;
    if (reserved.length < item.quantity) {
      throw new Error(`PREORDER_QR_ITEM:${item.product.name}`);
    }

    try {
      const qrCodes = await sellReservedProductUnits(tx, item.id);
      for (const code of qrCodes) {
        fiscalLines.push({
          name: item.product.name,
          price: item.price,
          qty: 1,
          eMark: code,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message === UNIT_STOCK_INSUFFICIENT) {
        throw new Error(`STOCK_INSUFFICIENT:${item.product.name}`);
      }
      throw error;
    }
  }
}

async function confirmQrOrderItemsFulfilled(tx: TxClient, ticketId: number) {
  await tx.orderItem.updateMany({
    where: {
      ticketId,
      fulfilledAt: null,
      product: {
        category: { notIn: [...QUANTITY_ONLY_CATEGORIES] },
      },
    },
    data: { fulfilledAt: new Date() },
  });
}

export async function confirmTicketEntryFulfillment(ticketId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await confirmQrOrderItemsFulfilled(tx, ticketId);
    });
    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');
    return { success: true };
  } catch (error) {
    console.error('[Confirm Ticket Entry Fulfillment] Error:', error);
    return { success: false, error: 'Ապրանքների տրամադրումը հաստատելիս սխալ է տեղի ունեցել' };
  }
}

export async function confirmOrderEntryFulfillment(orderId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const tickets = await prisma.ticket.findMany({
      where: { orderId, status: 'used' },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      for (const ticket of tickets) {
        await confirmQrOrderItemsFulfilled(tx, ticket.id);
      }
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');
    return { success: true };
  } catch (error) {
    console.error('[Confirm Order Entry Fulfillment] Error:', error);
    return {
      success: false,
      error: 'Ապրանքների տրամադրումը հաստատելիս սխալ է տեղի ունեցել',
    };
  }
}

export async function lookupPreOrderProductQr(
  qrCode: string,
  expectedCategory: string
) {
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

    if (!unit) {
      return { success: false, error: 'QR կոդը բազայում չի գտնվել' };
    }
    if (isQuantityOnlyProduct(unit.product.category)) {
      return {
        success: false,
        error: 'Պոպկոռնը ավելացվում է քանակով, առանց QR',
      };
    }
    if (!unit.product.isActive) {
      return { success: false, error: `«${unit.product.name}» ապրանքն ակտիվ չէ` };
    }
    if (unit.status !== 'in_stock') {
      return { success: false, error: 'Այս միավորն արդեն վաճառված է' };
    }
    if (unit.product.category !== expectedCategory) {
      return {
        success: false,
        error: `Այս QR-ը «${unit.product.name}» ապրանքին է (${unit.product.category}), սպասվում է ${expectedCategory} կատեգորիա`,
      };
    }

    return {
      success: true,
      unit: {
        id: unit.id,
        qrCode: unit.qrCode,
        productId: unit.product.id,
        name: unit.product.name,
        price: unit.product.price,
        category: unit.product.category,
      },
    };
  } catch (error) {
    console.error('[Lookup PreOrder Product QR] Error:', error);
    return { success: false, error: 'QR-ը ստուգելիս սխալ է տեղի ունեցել' };
  }
}

export async function attachPreOrderProductQrs(input: {
  orderItemId: number;
  qrCodes: string[];
  quantity: number;
}) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const orderItemId = Number(input.orderItemId);
  const quantity = Math.floor(Number(input.quantity));
  const qrCodes = Array.from(
    new Set((input.qrCodes ?? []).map((c) => (c ?? '').trim()).filter(Boolean))
  );

  if (!Number.isFinite(orderItemId) || orderItemId <= 0) {
    return { success: false, error: 'Անվավեր պատվերի տող' };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, error: 'Անվավեր քանակ' };
  }
  if (qrCodes.length !== quantity) {
    return {
      success: false,
      error: `Սկանված QR-ների քանակը (${qrCodes.length}) պետք է հավասար լինի քանակին (${quantity})`,
    };
  }

  try {
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        product: { select: { id: true, name: true, category: true, price: true } },
        ticket: { select: { id: true, status: true, orderId: true } },
        order: { select: { id: true, totalAmount: true } },
      },
    });

    if (!orderItem) {
      return { success: false, error: 'Պատվերի տողը չի գտնվել' };
    }
    if (!orderItem.ticketId || !orderItem.ticket) {
      return { success: false, error: 'Այս ապրանքը կապված չէ տոմսի հետ' };
    }
    if (orderItem.ticket.status === 'used') {
      return { success: false, error: 'Տոմսը արդեն մուտք է գործել' };
    }
    if (orderItem.fulfilledAt) {
      return { success: false, error: 'Ապրանքն արդեն տրված է' };
    }
    if (isQuantityOnlyProduct(orderItem.product.category)) {
      return {
        success: false,
        error: 'Պոպկոռնի համար QR կցում չի պահանջվում',
      };
    }

    const dbUnits = await prisma.productUnit.findMany({
      where: { qrCode: { in: qrCodes } },
      include: {
        product: {
          select: { id: true, name: true, category: true, isActive: true },
        },
      },
    });
    const byCode = new Map(dbUnits.map((u) => [u.qrCode, u]));
    const unitIds: number[] = [];

    for (const code of qrCodes) {
      const unit = byCode.get(code);
      if (!unit) {
        return { success: false, error: `QR «${code}» չի գտնվել` };
      }
      if (!unit.product.isActive) {
        return { success: false, error: `«${unit.product.name}» ապրանքն ակտիվ չէ` };
      }
      if (unit.status !== 'in_stock') {
        return { success: false, error: `QR «${code}» արդեն վաճառված է` };
      }
      if (unit.product.category !== orderItem.product.category) {
        return {
          success: false,
          error: `QR «${code}»-ը ${unit.product.category} կատեգորիայի է, սպասվում է ${orderItem.product.category}`,
        };
      }
      if (unit.orderItemId != null && unit.orderItemId !== orderItemId) {
        return { success: false, error: `QR «${code}» արդեն կցված է այլ պատվերի` };
      }
      unitIds.push(unit.id);
    }

    await prisma.$transaction(async (tx) => {
      await clearOrderItemQrReservations(tx, orderItemId);

      if (quantity !== orderItem.quantity) {
        const diff = (quantity - orderItem.quantity) * orderItem.price;
        await tx.orderItem.update({
          where: { id: orderItemId },
          data: { quantity },
        });
        await tx.order.update({
          where: { id: orderItem.orderId },
          data: { totalAmount: { increment: diff } },
        });
      }

      await reserveProductUnitsForOrderItem(tx, orderItemId, unitIds);
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: `${quantity} QR կցվեց «${orderItem.product.name}» ապրանքին`,
    };
  } catch (error) {
    if (error instanceof Error && error.message === UNIT_STOCK_INSUFFICIENT) {
      return {
        success: false,
        error: 'Մի կամ մի քանի QR արդեն անհասանելի է',
      };
    }
    console.error('[Attach PreOrder Product QRs] Error:', error);
    return { success: false, error: 'QR-ները կցելիս սխալ է տեղի ունեցել' };
  }
}

/**
 * Հեռացնել ապրանքը ամրագրված (դեռ չվճարված) տոմսի պատվերից։
 * Ապրանքը դեռ ՀԴՄ չի ուղարկվել և պաշարը չի հանվել՝ ուստի պարզապես
 * ազատում ենք ամրագրումը և իջեցնում պատվերի գումարը (առանց ՀԴՄ)։
 * Վճարված տոմսերի ապրանքները հեռացվում են դրամարկղից՝ վերադարձով։
 */
export async function removeTicketOrderItem(orderItemId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const id = Number(orderItemId);
  if (!Number.isFinite(id) || id <= 0) {
    return { success: false, error: 'Անվավեր պատվերի տող' };
  }

  try {
    const orderItem = await prisma.orderItem.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, category: true } },
        ticket: { select: { id: true, status: true } },
        order: { select: { id: true, status: true, totalAmount: true } },
        units: { select: { id: true, status: true } },
      },
    });

    if (!orderItem) {
      return { success: false, error: 'Պատվերի տողը չի գտնվել' };
    }
    if (!orderItem.ticketId || !orderItem.ticket) {
      return { success: false, error: 'Ապրանքը կապված չէ տոմսի հետ' };
    }
    if (orderItem.ticket.status === 'used') {
      return { success: false, error: 'Տոմսը արդեն մուտք է գործել' };
    }
    if (!isUnpaidHeldStatus(orderItem.ticket.status)) {
      return {
        success: false,
        error:
          'Վճարված տոմսի ապրանքը հեռացվում է դրամարկղից՝ վերադարձով, ոչ այստեղ',
      };
    }

    const lineTotal = orderItem.price * orderItem.quantity;
    const productName = orderItem.product.name;
    // Ապրանքը արդեն վաճառված/տրված է (հին հոսք) → վերադարձնել պաշարը
    const wasFinalized = Boolean(orderItem.fulfilledAt);

    await prisma.$transaction(async (tx) => {
      // Ամրագրված (in_stock) միավորները ազատել
      await clearOrderItemQrReservations(tx, id);
      // Եթե արդեն վերջնականացված էր (վաճառված/պաշարից հանված)՝ վերադարձնել պաշարը
      if (wasFinalized) {
        await returnOrderItemStock(
          tx,
          id,
          orderItem.productId,
          orderItem.product.category,
          orderItem.quantity
        );
      }
      await tx.orderItem.delete({ where: { id } });

      const nextTotal = Math.max(0, orderItem.order.totalAmount - lineTotal);
      await tx.order.update({
        where: { id: orderItem.orderId },
        data: { totalAmount: nextTotal },
      });
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/products');
    revalidatePath('/admin/product-units');

    return {
      success: true,
      message: `«${productName}»-ը հեռացվեց պատվերից (−${lineTotal} ֏)`,
    };
  } catch (error) {
    console.error('[Remove Ticket Order Item] Error:', error);
    return { success: false, error: 'Ապրանքը հեռացնելիս սխալ է տեղի ունեցել' };
  }
}

async function attachPreOrderProductQrsInTx(
  tx: TxClient,
  orderItemId: number,
  qrCodes: string[],
  quantity: number
) {
  const orderItem = await tx.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      product: { select: { id: true, name: true, category: true, price: true } },
      ticket: { select: { id: true, status: true } },
      order: { select: { id: true, totalAmount: true } },
    },
  });

  if (!orderItem?.ticketId) {
    throw new Error('INVALID_ORDER_ITEM');
  }
  if (isQuantityOnlyProduct(orderItem.product.category)) {
    throw new Error('POPCORN_NO_QR');
  }

  const dbUnits = await tx.productUnit.findMany({
    where: { qrCode: { in: qrCodes } },
    select: {
      id: true,
      qrCode: true,
      status: true,
      orderItemId: true,
      product: { select: { category: true, isActive: true, name: true } },
    },
  });
  const byCode = new Map(dbUnits.map((u) => [u.qrCode, u]));
  const unitIds: number[] = [];

  for (const code of qrCodes) {
    const unit = byCode.get(code);
    if (!unit || !unit.product.isActive || unit.status !== 'in_stock') {
      throw new Error(UNIT_STOCK_INSUFFICIENT);
    }
    if (unit.product.category !== orderItem.product.category) {
      throw new Error(`CATEGORY_MISMATCH:${orderItem.product.name}`);
    }
    if (unit.orderItemId != null && unit.orderItemId !== orderItemId) {
      throw new Error(UNIT_STOCK_INSUFFICIENT);
    }
    unitIds.push(unit.id);
  }

  await clearOrderItemQrReservations(tx, orderItemId);

  if (quantity !== orderItem.quantity) {
    const diff = (quantity - orderItem.quantity) * orderItem.price;
    await tx.orderItem.update({
      where: { id: orderItemId },
      data: { quantity },
    });
    await tx.order.update({
      where: { id: orderItem.orderId },
      data: { totalAmount: { increment: diff } },
    });
  }

  await reserveProductUnitsForOrderItem(tx, orderItemId, unitIds);
}

/** Սկանավորել QR-ը և գտնել համապատասխան ամրագրված ապրանքի տողը */
export async function lookupPreOrderProductQrForTicket(
  ticketId: number,
  qrCode: string
) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const code = (qrCode ?? '').trim();
  if (!code) {
    return { success: false, error: 'QR կոդը դատարկ է' };
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        orderItems: {
          where: { fulfilledAt: null },
          include: {
            product: { select: { name: true, category: true } },
            units: { select: { qrCode: true, status: true } },
          },
        },
      },
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել' };
    }

    const unit = await prisma.productUnit.findUnique({
      where: { qrCode: code },
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

    if (!unit) {
      return { success: false, error: 'QR կոդը բազայում չի գտնվել' };
    }
    if (isQuantityOnlyProduct(unit.product.category)) {
      return { success: false, error: 'Պոպկոռնը QR-ով չի վաճառվում' };
    }
    if (!unit.product.isActive) {
      return { success: false, error: `«${unit.product.name}» ապրանքն ակտիվ չէ` };
    }
    if (unit.status !== 'in_stock') {
      return { success: false, error: 'Այս միավորն արդեն վաճառված է' };
    }

    const pendingLines = ticket.orderItems.filter(
      (item) => !isQuantityOnlyProduct(item.product.category)
    );

    const target = pendingLines.find((item) => {
      if (item.product.category !== unit.product.category) return false;
      const attached =
        item.units?.filter(
          (u) => u.status === 'in_stock' || u.status === 'sold'
        ).length ?? 0;
      return attached < item.quantity;
    });

    if (!target) {
      const hasCategory = pendingLines.some(
        (item) => item.product.category === unit.product.category
      );
      return {
        success: false,
        error: hasCategory
          ? `«${unit.product.name}»-ի բոլոր QR-ները արդեն սկանավորված են`
          : `Այս տոմսին "${unit.product.category}" կատեգորիայի ապրանք չի ամրագրվել`,
      };
    }

    return {
      success: true,
      unit: {
        id: unit.id,
        qrCode: unit.qrCode,
        productId: unit.product.id,
        name: unit.product.name,
        price: unit.product.price,
        category: unit.product.category,
      },
      orderItemId: target.id,
      orderItemName: target.product.name,
    };
  } catch (error) {
    console.error('[Lookup PreOrder QR For Ticket] Error:', error);
    return { success: false, error: 'QR-ը ստուգելիս սխալ է տեղի ունեցել' };
  }
}

/** QR-ները կցել + մուտք գործարկել + ֆիսկալ տվյալներ մեկ քայլով */
export async function completeTicketEntry(input: {
  ticketId: number;
  items: Array<{ orderItemId: number; qrCodes: string[]; quantity: number }>;
}) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const ticketId = Number(input.ticketId);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return { success: false, error: 'Անվավեր տոմս' };
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        order: { select: { id: true, paymentMethod: true } },
        seat: { select: { row: true, number: true } },
        screening: { include: { movie: { select: { title: true } } } },
        orderItems: {
          where: { fulfilledAt: null },
          include: {
            product: { select: { name: true, category: true } },
            units: { select: { qrCode: true, status: true } },
          },
        },
      },
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել' };
    }
    if (ticket.status === 'used') {
      return { success: false, error: 'Տոմսը արդեն մուտք է գործել' };
    }
    if (ticket.status !== 'paid') {
      return { success: false, error: 'Տոմսը պետք է լինի վճարված' };
    }

    const qrLines = ticket.orderItems.filter(
      (item) => !isQuantityOnlyProduct(item.product.category)
    );

    for (const line of qrLines) {
      const payload = input.items.find((i) => i.orderItemId === line.id);
      const qrCodes = Array.from(
        new Set((payload?.qrCodes ?? []).map((c) => c.trim()).filter(Boolean))
      );
      const quantity = Math.floor(Number(payload?.quantity ?? line.quantity));
      if (qrCodes.length !== quantity) {
        return {
          success: false,
          error: `«${line.product.name}»-ի համար սկանավորեք ${line.quantity} QR`,
        };
      }
    }

    // ՀԴՄ-ին ուղարկում ենք ՄԻԱՅՆ ապրանքները (QR/eMark)։ Տոմսը արդեն վճարված է
    // (օնլայն/ամրագրման վճարում)՝ մուտքի պահին ՀԴՄ կրկին չի ուղարկվում։
    const fiscalLines: EntryFiscalLine[] = [];

    await prisma.$transaction(async (tx) => {
      for (const line of qrLines) {
        const payload = input.items.find((i) => i.orderItemId === line.id)!;
        const qrCodes = Array.from(
          new Set(payload.qrCodes.map((c) => c.trim()).filter(Boolean))
        );
        await attachPreOrderProductQrsInTx(
          tx,
          line.id,
          qrCodes,
          payload.quantity
        );
      }

      await fulfillTicketProducts(tx, ticketId, fiscalLines);
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'used' },
      });
    });

    const productLines = fiscalLines.filter((line) => line.eMark);
    const productsTotal = productLines.reduce(
      (sum, line) => sum + line.price * line.qty,
      0
    );
    const paymentMethod =
      ticket.order?.paymentMethod === 'card' ? 'card' : 'cash';

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: 'Մուտքը հաստատված է',
      fiscal:
        productLines.length > 0
          ? {
              orderId: ticket.orderId,
              ticketId,
              paymentMethod,
              total: productsTotal,
              lines: productLines,
              needsFulfillmentConfirm: true,
            }
          : null,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('CATEGORY_MISMATCH:')) {
      const name = error.message.slice('CATEGORY_MISMATCH:'.length);
      return { success: false, error: `QR-ի կատեգորիան չի համապատասխանում «${name}»-ին` };
    }
    const stockError = mapStockError(error);
    if (stockError) {
      return { success: false, error: stockError };
    }
    console.error('[Complete Ticket Entry] Error:', error);
    return { success: false, error: 'Մուտքը հաստատելիս սխալ է տեղի ունեցել' };
  }
}

/**
 * Ամրագրված (դեռ չվճարված) տոմսի օնլայն ապրանքներին QR կցել՝ առանց մուտքի ու ՀԴՄ-ի։
 * Միավորները ամրագրվում են (in_stock), իսկ վաճառքն ու ՀԴՄ-ն կատարվում են
 * դրամարկղում վճարելիս (`payReservationAtCounter`)։
 */
export async function attachTicketPreOrderQrs(input: {
  ticketId: number;
  items: Array<{ orderItemId: number; qrCodes: string[]; quantity: number }>;
}) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const ticketId = Number(input.ticketId);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return { success: false, error: 'Անվավեր տոմս' };
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        orderItems: {
          where: { fulfilledAt: null },
          include: {
            product: { select: { name: true, category: true } },
            units: { select: { qrCode: true, status: true } },
          },
        },
      },
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել' };
    }
    if (ticket.status === 'used') {
      return { success: false, error: 'Տոմսը արդեն մուտք է գործել' };
    }
    if (!isUnpaidHeldStatus(ticket.status)) {
      return {
        success: false,
        error: 'Այս գործողությունը միայն ամրագրված տոմսերի համար է',
      };
    }

    const qrLines = ticket.orderItems.filter(
      (item) => !isQuantityOnlyProduct(item.product.category)
    );

    for (const line of qrLines) {
      const payload = input.items.find((i) => i.orderItemId === line.id);
      const qrCodes = Array.from(
        new Set((payload?.qrCodes ?? []).map((c) => c.trim()).filter(Boolean))
      );
      const quantity = Math.floor(Number(payload?.quantity ?? line.quantity));
      if (qrCodes.length !== quantity) {
        return {
          success: false,
          error: `«${line.product.name}»-ի համար սկանավորեք ${line.quantity} QR`,
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const line of qrLines) {
        const payload = input.items.find((i) => i.orderItemId === line.id)!;
        const qrCodes = Array.from(
          new Set(payload.qrCodes.map((c) => c.trim()).filter(Boolean))
        );
        await attachPreOrderProductQrsInTx(
          tx,
          line.id,
          qrCodes,
          payload.quantity
        );
      }
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/product-units');

    return {
      success: true,
      message: 'QR-ները կցվեցին · վճարումը կատարեք դրամարկղում',
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('CATEGORY_MISMATCH:')) {
      const name = error.message.slice('CATEGORY_MISMATCH:'.length);
      return {
        success: false,
        error: `QR-ի կատեգորիան չի համապատասխանում «${name}»-ին`,
      };
    }
    const stockError = mapStockError(error);
    if (stockError) {
      return { success: false, error: stockError };
    }
    console.error('[Attach Ticket PreOrder Qrs] Error:', error);
    return { success: false, error: 'QR-ները կցելիս սխալ է տեղի ունեցել' };
  }
}

function mapStockError(error: unknown): string | null {
  const preOrderError = mapPreOrderQrError(error);
  if (preOrderError) return preOrderError;
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
      include: {
        order: { select: { id: true, paymentMethod: true } },
        seat: { select: { row: true, number: true } },
        screening: { include: { movie: { select: { title: true } } } },
      },
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

    // ՀԴՄ-ին ուղարկում ենք ՄԻԱՅՆ ապրանքները (QR/eMark)։ Վճարված տոմսը
    // մուտքի պահին ՀԴՄ կրկին չի ուղարկվում։
    const fiscalLines: EntryFiscalLine[] = [];

    await prisma.$transaction(async (tx) => {
      await fulfillTicketProducts(tx, ticketId, fiscalLines);
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'used' },
      });
    });

    const productLines = fiscalLines.filter((line) => line.eMark);
    const productsTotal = productLines.reduce(
      (sum, line) => sum + line.price * line.qty,
      0
    );
    const paymentMethod =
      ticket.order?.paymentMethod === 'card' ? 'card' : 'cash';

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: 'Տոմսը հաջողությամբ նշվեց որպես օգտագործված',
      fiscal:
        productLines.length > 0
          ? {
              orderId: ticket.orderId,
              ticketId,
              paymentMethod,
              total: productsTotal,
              lines: productLines,
              needsFulfillmentConfirm: true,
            }
          : null,
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

async function unfulfillTicketProducts(tx: TxClient, ticketId: number) {
  const items = await tx.orderItem.findMany({
    where: { ticketId, fulfilledAt: { not: null } },
    include: {
      product: { select: { id: true, category: true } },
      units: {
        where: { status: 'sold' },
        select: { id: true },
      },
    },
  });

  for (const item of items) {
    const soldUnitIds = item.units.map((unit) => unit.id);

    await returnOrderItemStock(
      tx,
      item.id,
      item.product.id,
      item.product.category,
      item.quantity
    );

    if (
      !isQuantityOnlyProduct(item.product.category) &&
      soldUnitIds.length > 0
    ) {
      await reserveProductUnitsForOrderItem(tx, item.id, soldUnitIds);
    }

    await tx.orderItem.update({
      where: { id: item.id },
      data: { fulfilledAt: null },
    });
  }
}

export async function unmarkTicketAsUsed(ticketId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });

    if (!ticket) {
      return { success: false, error: 'Տոմսը չի գտնվել' };
    }

    if (ticket.status !== 'used') {
      return { success: false, error: 'Տոմսը օգտագործված չէ' };
    }

    await prisma.$transaction(async (tx) => {
      await unfulfillTicketProducts(tx, ticketId);
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'paid', preparationServedAt: null },
      });
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: 'Տոմսը հաջողությամբ վերադարձվեց որպես վճարված',
    };
  } catch (error: unknown) {
    console.error('[Unmark Ticket As Used] Error:', error);
    return {
      success: false,
      error: 'Տոմսը վերադարձնելիս սխալ է տեղի ունեցել',
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
        tickets: {
          include: {
            seat: { select: { row: true, number: true } },
            screening: { include: { movie: { select: { title: true } } } },
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

    const paidTickets = order.tickets.filter((t) => t.status === 'paid');

    if (paidTickets.length === 0) {
      return {
        success: false,
        error: 'Պատվերում վճարված տոմսեր չկան',
      };
    }

    // ՀԴՄ-ին ուղարկում ենք ՄԻԱՅՆ ապրանքները (QR/eMark)։ Վճարված տոմսերը
    // մուտքի պահին ՀԴՄ կրկին չեն ուղարկվում։
    const fiscalLines: EntryFiscalLine[] = [];

    await prisma.$transaction(async (tx) => {
      for (const t of paidTickets) {
        await fulfillTicketProducts(tx, t.id, fiscalLines);
      }
      await tx.ticket.updateMany({
        where: {
          id: { in: paidTickets.map((t) => t.id) },
          status: 'paid',
        },
        data: { status: 'used' },
      });
    });

    const productLines = fiscalLines.filter((line) => line.eMark);
    const productsTotal = productLines.reduce(
      (sum, line) => sum + line.price * line.qty,
      0
    );
    const paymentMethod = order.paymentMethod === 'card' ? 'card' : 'cash';

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');

    return {
      success: true,
      message: `${paidTickets.length} տոմս հաջողությամբ նշվեց որպես օգտագործված`,
      fiscal:
        productLines.length > 0
          ? {
              orderId,
              paymentMethod,
              total: productsTotal,
              lines: productLines,
              needsFulfillmentConfirm: true,
            }
          : null,
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
 * Որոնում է պատվերներ (ամրագրումներ և գնված տոմսեր)՝ ըստ պատվերի համարի
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

    const where: any = {};

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
      where.tickets = {
        some: {
          status: { in: ['reserved', 'awaiting_payment', 'paid', 'used'] },
        },
      };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, isBlocked: true } },
        tickets: {
          where: { status: { not: 'cancelled' } },
          include: {
            seat: { select: { row: true, number: true } },
            screening: {
              include: { movie: { select: { title: true } } },
            },
          },
          orderBy: [{ screening: { startTime: 'asc' } }, { id: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const results = orders
      .filter((order) => order.tickets.length > 0)
      .map((order) => {
        const reserved = order.tickets.filter((t) =>
          isUnpaidHeldStatus(t.status)
        );
        const paid = order.tickets.filter((t) => t.status === 'paid');
        const used = order.tickets.filter((t) => t.status === 'used');
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
          paidCount: paid.length,
          usedCount: used.length,
          totalAmount: order.totalAmount,
          status: order.status,
          tickets: order.tickets.map((ticket) => ({
            id: ticket.id,
            status: ticket.status,
            seatLabel: ticket.seat
              ? `${ticket.seat.row}-${ticket.seat.number}`
              : '',
            movieTitle: ticket.screening?.movie?.title || null,
            startTime: ticket.screening?.startTime || null,
          })),
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
        tickets: {
          include: {
            seat: { select: { row: true, number: true } },
            screening: { include: { movie: { select: { title: true } } } },
          },
        },
        orderItems: {
          include: {
            product: { select: { name: true, category: true } },
            units: { select: { qrCode: true } },
          },
        },
        user: { select: { id: true } },
      },
    });

    if (!order) {
      return { success: false, error: 'Պատվերը չի գտնվել' };
    }

    const reservedTickets = order.tickets.filter((t) =>
      isUnpaidHeldStatus(t.status)
    );
    if (reservedTickets.length === 0) {
      return {
        success: false,
        error: 'Այս պատվերում չվճարված ամրագրված տոմսեր չկան',
      };
    }

    // Գանձվող ապրանքները՝ միայն ամրագրված տոմսերին կապվածները և
    // պատվերի մակարդակի (առանց տոմսի) ապրանքները։ Վճարված տոմսերի
    // ապրանքներն արդեն վճարված են՝ չենք կրկնագանձում/վերավաճառում։
    const reservedTicketIds = new Set(reservedTickets.map((t) => t.id));
    const chargeableItems = order.orderItems.filter(
      (item) => item.ticketId == null || reservedTicketIds.has(item.ticketId)
    );

    // Ստուգում՝ ամրագրված (դեռ չվերջնականացված) ապրանքների համար
    for (const item of chargeableItems) {
      if (item.fulfilledAt) continue;
      if (isQuantityOnlyProduct(item.product.category)) {
        // Պոպկորն՝ պաշարի ստուգում
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, name: true },
        });
        if (!product || product.stock < item.quantity) {
          return {
            success: false,
            error: `«${item.product.name}» ապրանքի պաշարը բավարար չէ (առկա է ${product?.stock ?? 0})`,
          };
        }
      } else {
        // QR ապրանք՝ պետք է սկանավորված/կցված լինի մինչև վճարումը
        const attached = item.units.filter((u) => u.qrCode).length;
        if (attached < item.quantity) {
          return {
            success: false,
            error: `Նախ սկանավորեք «${item.product.name}»-ի QR-ները (${attached}/${item.quantity})`,
          };
        }
      }
    }

    const ticketsTotal = reservedTickets.reduce(
      (sum, t) => sum + (t.price || 0),
      0
    );
    const productsTotal = chargeableItems.reduce(
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

      // Ապրանքների վերջնականացում՝ ամրագրված միավորները վաճառել, պոպկորնի
      // պաշարը հանել, նշել տրված (միայն դեռ չվերջնականացված գանձվողների համար)
      for (const item of chargeableItems) {
        if (item.fulfilledAt) continue;
        if (isQuantityOnlyProduct(item.product.category)) {
          await sellQuantityStock(tx, item.productId, item.quantity);
        } else {
          await sellReservedProductUnits(tx, item.id);
        }
        await tx.orderItem.update({
          where: { id: item.id },
          data: { fulfilledAt: new Date() },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          paymentMethod: method,
          amountPaid,
        },
      });

      // Բոնուսային միավորներ՝ ամրագրումը վճարող օգտատիրոջը
      await awardBonusForSale(tx, {
        userId: order.userId,
        ticketAmount: ticketsTotal,
        productAmount: productsTotal,
        orderId: order.id,
        source: 'scanner',
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

    // Ֆիսկալ տողեր՝ տոմսեր + ապրանքներ (eMark-երը՝ վաճառված միավորների QR-երից)
    const fiscalLines: Array<{
      name: string;
      price: number;
      qty: number;
      eMark?: string | null;
      isTicket?: boolean;
    }> = [];
    for (const t of reservedTickets) {
      const seatLabel = t.seat ? `${t.seat.row}${t.seat.number}` : '';
      const movieTitle = t.screening?.movie?.title ?? 'ֆիլմ';
      fiscalLines.push({
        name: `Տոմս · ${movieTitle}${seatLabel ? ` · ${seatLabel}` : ''}`.slice(
          0,
          50
        ),
        price: t.price,
        qty: 1,
        isTicket: true,
      });
    }
    for (const item of chargeableItems) {
      const isQtyOnly = isQuantityOnlyProduct(item.product.category);
      if (isQtyOnly) {
        fiscalLines.push({
          name: item.product.name,
          price: item.price,
          qty: item.quantity,
          eMark: null,
        });
      } else {
        const codes = item.units.map((u) => u.qrCode);
        for (let i = 0; i < item.quantity; i += 1) {
          fiscalLines.push({
            name: item.product.name,
            price: item.price,
            qty: 1,
            eMark: codes[i] ?? null,
          });
        }
      }
    }

    return {
      success: true,
      total: grandTotal,
      amountPaid,
      change: method === 'cash' ? (amountPaid as number) - grandTotal : 0,
      paidCount: reservedTickets.length,
      message: `${reservedTickets.length} տոմս վճարվեց դրամարկղում`,
      fiscal: {
        orderId: order.id,
        paymentMethod: method,
        total: grandTotal,
        lines: fiscalLines,
      },
    };
  } catch (error: unknown) {
    const stockError = mapStockError(error);
    if (stockError) {
      return { success: false, error: stockError };
    }
    if (error instanceof Error && error.message === UNIT_STOCK_INSUFFICIENT) {
      return {
        success: false,
        error: 'Ապրանքի միավորն այլևս հասանելի չէ — կրկին սկանավորեք QR-ը',
      };
    }
    console.error('[Pay Reservation At Counter] Error:', error);
    return {
      success: false,
      error: 'Վճարումը մշակելիս սխալ է տեղի ունեցել',
    };
  }
}

export interface CustomerScannerTicketRow {
  id: number;
  orderId: number | null;
  status: string;
  price: number;
  productsTotal: number;
  movieTitle: string;
  startTime: string;
  seatLabel: string;
  inTargetOrder: boolean;
  canAdd: boolean;
}

async function recalculateOrderTotalInTx(tx: TxClient, orderId: number) {
  const tickets = await tx.ticket.findMany({
    where: { orderId, status: { not: 'cancelled' } },
    select: { price: true },
  });
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { price: true, quantity: true },
  });
  const total =
    tickets.reduce((sum, ticket) => sum + (ticket.price || 0), 0) +
    items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  await tx.order.update({
    where: { id: orderId },
    data: { totalAmount: total },
  });

  return total;
}

async function finalizeOrderAfterTicketMove(tx: TxClient, orderId: number) {
  const ticketCount = await tx.ticket.count({
    where: { orderId, status: { not: 'cancelled' } },
  });
  const itemCount = await tx.orderItem.count({ where: { orderId } });

  if (ticketCount === 0 && itemCount === 0) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'cancelled', totalAmount: 0 },
    });
    return 0;
  }

  return recalculateOrderTotalInTx(tx, orderId);
}

/** Հաճախորդի բոլոր տոմսերը scanner-ի մոդալի համար */
export async function getCustomerTicketsForScanner(input: {
  userId: number;
  targetOrderId?: number | null;
}): Promise<{
  success: boolean;
  error: string | null;
  tickets: CustomerScannerTicketRow[];
}> {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', tickets: [] };
  }

  const userId = Number(input.userId);
  const targetOrderId = input.targetOrderId
    ? Number(input.targetOrderId)
    : null;

  if (!Number.isFinite(userId)) {
    return { success: false, error: 'Սխալ օգտատեր', tickets: [] };
  }

  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        userId,
        status: { in: ['reserved', 'awaiting_payment', 'paid', 'used'] },
      },
      include: {
        screening: {
          include: { movie: { select: { title: true } } },
        },
        seat: { select: { row: true, number: true } },
        orderItems: { select: { price: true, quantity: true } },
      },
      orderBy: [{ screening: { startTime: 'asc' } }, { id: 'asc' }],
    });

    const rows: CustomerScannerTicketRow[] = tickets.map((ticket) => {
      const productsTotal = ticket.orderItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const inTargetOrder =
        targetOrderId != null && ticket.orderId === targetOrderId;
      return {
        id: ticket.id,
        orderId: ticket.orderId,
        status: ticket.status,
        price: ticket.price,
        productsTotal,
        movieTitle: ticket.screening.movie.title,
        startTime: ticket.screening.startTime.toISOString(),
        seatLabel: `${ticket.seat.row}${ticket.seat.number}`,
        inTargetOrder,
        canAdd:
          isUnpaidHeldStatus(ticket.status) &&
          targetOrderId != null &&
          ticket.orderId !== targetOrderId,
      };
    });

    return { success: true, error: null, tickets: rows };
  } catch (error) {
    console.error('[Get Customer Tickets For Scanner] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել',
      tickets: [],
    };
  }
}

/** Չվճարված տոմսերը միավորել մեկ պատվերի մեջ՝ միասին վճարելու համար */
export async function mergeReservedTicketsIntoOrder(input: {
  targetOrderId: number;
  ticketIds: number[];
}): Promise<{ success: boolean; error: string | null; message?: string }> {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const targetOrderId = Number(input.targetOrderId);
  const ticketIds = Array.from(
    new Set(
      (input.ticketIds ?? [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  if (!Number.isFinite(targetOrderId) || ticketIds.length === 0) {
    return { success: false, error: 'Ընտրեք առնվազն մեկ տոմս' };
  }

  try {
    const targetOrder = await prisma.order.findUnique({
      where: { id: targetOrderId },
      select: { id: true, userId: true, status: true },
    });

    if (!targetOrder) {
      return { success: false, error: 'Պատվերը չի գտնվել' };
    }
    if (targetOrder.status === 'cancelled') {
      return { success: false, error: 'Պատվերը չեղարկված է' };
    }

    const tickets = await prisma.ticket.findMany({
      where: { id: { in: ticketIds } },
      select: { id: true, orderId: true, userId: true, status: true },
    });

    if (tickets.length !== ticketIds.length) {
      return { success: false, error: 'Որոշ տոմսեր չեն գտնվել' };
    }

    for (const ticket of tickets) {
      if (ticket.userId !== targetOrder.userId) {
        return {
          success: false,
          error: 'Բոլոր տոմսերը պետք է պատկանեն նույն հաճախորդին',
        };
      }
      if (!isUnpaidHeldStatus(ticket.status)) {
        return {
          success: false,
          error: 'Միայն չվճարված (ամրագրված) տոմսերը կարելի է ավելացնել',
        };
      }
      if (ticket.orderId === targetOrderId) {
        return {
          success: false,
          error: 'Տոմսերից մեկը արդեն այս պատվերում է',
        };
      }
    }

    const sourceOrderIds = Array.from(
      new Set(
        tickets
          .map((t) => t.orderId)
          .filter((id): id is number => id != null && id !== targetOrderId)
      )
    );

    await prisma.$transaction(async (tx) => {
      for (const ticketId of ticketIds) {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { orderId: targetOrderId },
        });
        await tx.orderItem.updateMany({
          where: { ticketId },
          data: { orderId: targetOrderId },
        });
      }

      await recalculateOrderTotalInTx(tx, targetOrderId);

      for (const sourceOrderId of sourceOrderIds) {
        await finalizeOrderAfterTicketMove(tx, sourceOrderId);
      }
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');
    revalidatePath('/tickets');

    return {
      success: true,
      error: null,
      message: `${ticketIds.length} տոմս ավելացվեց պատվեր #${targetOrderId}-ին`,
    };
  } catch (error) {
    console.error('[Merge Reserved Tickets Into Order] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը միավորելիս սխալ է տեղի ունեցել',
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

    // QR միավորների վալիդացիա (խմբավորում ըստ ապրանքի)
    const unitsByProduct = new Map<
      number,
      { price: number; costPrice: number; name: string; unitIds: number[] }
    >();
    let productsTotal = 0;
    // Ֆիսկալ կտրոնի տողերը (միայն անմիջական վաճառքի դեպքում է ուղարկվում ՀԴՄ)
    const fiscalLines: Array<{
      name: string;
      price: number;
      qty: number;
      eMark?: string | null;
    }> = [];

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
          return {
            success: false,
            error: `QR «${code}» արդեն վաճառված է`,
          };
        }

        const group = unitsByProduct.get(unit.product.id) ?? {
          price: unit.product.price,
          costPrice: unit.product.costPrice,
          name: unit.product.name,
          unitIds: [],
        };
        group.unitIds.push(unit.id);
        unitsByProduct.set(unit.product.id, group);
        productsTotal += unit.product.price;
        fiscalLines.push({
          name: unit.product.name,
          price: unit.product.price,
          qty: 1,
          eMark: code,
        });
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
      productsTotal += product.price * qty;
      fiscalLines.push({
        name: product.name,
        price: product.price,
        qty,
        eMark: null,
      });
    }

    // Ապրանքները միշտ ավելանում են պատվերին (ամրագրում)։
    // Անմիջական վաճառք/վճարում/ֆիսկալ՝ միայն եթե կանչողը հստակ payment է փոխանցել
    // (հին համատեղելիություն)։ Նոր UI-ում տոմսի մոդալը payment չի ուղարկում։
    const wantsImmediateSale = Boolean(data.paymentMethod);
    let payment: {
      ok: true;
      method: ScannerPaymentMethod;
      amountPaid: number | null;
    } | null = null;
    if (wantsImmediateSale) {
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
    const sellNow = wantsImmediateSale && payment != null;

    let finalOrderId: number | null = ticket.orderId ?? null;

    await prisma.$transaction(async (tx) => {
      let orderId = ticket.orderId;

      if (!orderId) {
        const order = await tx.order.create({
          data: {
            userId: ticket.userId,
            totalAmount: productsTotal,
            status: sellNow ? 'completed' : 'pending',
            ...(sellNow && payment
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
            // Անմիջական վաճառք → completed; ավելացում պատվերին → pending
            // (որ դրամարկղում կարողանան վճարել նոր ապրանքները)
            status: sellNow ? 'completed' : 'pending',
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
            costPrice: group.costPrice ?? 0,
            // sellNow՝ անմիջապես տրվում է; հակառակ դեպքում՝ ամրագրվում է մինչև վճարում
            fulfilledAt: sellNow ? new Date() : null,
          },
        });
        if (sellNow) {
          await sellSpecificProductUnits(tx, group.unitIds, item.id);
        } else {
          // Ամրագրում՝ միավորները մնում են in_stock, կապվում պատվերի տողին
          await reserveProductUnitsForOrderItem(tx, item.id, group.unitIds);
        }
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
            costPrice: product.costPrice ?? 0,
            fulfilledAt: sellNow ? new Date() : null,
          },
        });
        // Ամրագրման դեպքում պաշարը չենք հանում մինչև վճարումը
        if (sellNow) {
          await sellQuantityStock(tx, sel.productId, qty);
        }
      }

      finalOrderId = orderId;
    });

    const seatLabel = ticket.seat
      ? `${ticket.seat.row}${ticket.seat.number}`
      : '';
    const movieTitle = ticket.screening?.movie?.title ?? 'ֆիլմ';
    const paymentNote = sellNow
      ? ` (${payment?.method === 'card' ? 'քարտով' : 'կանխիկ'})`
      : ' (ավելացվեց պատվերին)';

    await createNotification({
      type: 'box_office',
      title: sellNow
        ? 'Մուտքի կետ՝ ապրանքների վաճառք'
        : 'Մուտքի կետ՝ ապրանքներ պատվերին',
      message: `${movieTitle}${seatLabel ? `, տեղ ${seatLabel}` : ''} — ${formatAmd(productsTotal)}${paymentNote}`,
      link: '/admin/scanner',
    });

    revalidatePath('/admin/scanner');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/notifications');

    return {
      success: true,
      total: productsTotal,
      paid: sellNow,
      message: sellNow
        ? 'Ապրանքները վաճառվեցին տոմսին'
        : 'Ապրանքներն ավելացվեցին պատվերին (վճարումը՝ դրամարկղում)',
      // Ֆիսկալ տվյալներ՝ միայն անմիջական վաճառքի դեպքում (բրաուզերը ուղարկում է ՀԴՄ)
      fiscal: sellNow
        ? {
            orderId: finalOrderId,
            ticketId,
            paymentMethod: (payment?.method ?? 'cash') as 'cash' | 'card',
            total: productsTotal,
            lines: fiscalLines,
          }
        : null,
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
