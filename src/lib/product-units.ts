import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Ապրանքների պաշարի կառավարում։
 *
 * - `popcorn` և այլ QUANTITY_ONLY կատեգորիաներ՝ պարզ քանակ (stock դաշտ)
 * - Մնացածը՝ ամեն միավորի ունիկալ QR (ProductUnit), վաճառվածը մնում է բազայում
 */

type Tx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** QR-հաշվառում չունեցող կատեգորիաներ — վաճառվում են քանակով */
export const QUANTITY_ONLY_CATEGORIES = ['popcorn'] as const;

export function usesQrUnitTracking(category: string): boolean {
  return !QUANTITY_ONLY_CATEGORIES.includes(
    category as (typeof QUANTITY_ONLY_CATEGORIES)[number]
  );
}

export function isQuantityOnlyProduct(category: string): boolean {
  return !usesQrUnitTracking(category);
}

/** Սխալ, երբ պահեստում բավարար միավոր/քանակ չկա */
export const UNIT_STOCK_INSUFFICIENT = 'UNIT_STOCK_INSUFFICIENT';

/** Համաժամեցնել product.stock = in_stock միավորների քանակ (միայն QR ապրանքների համար) */
export async function syncProductStock(tx: Tx, productId: number) {
  const inStock = await tx.productUnit.count({
    where: { productId, status: 'in_stock' },
  });
  await tx.product.update({
    where: { id: productId },
    data: { stock: inStock },
  });
  return inStock;
}

/** Քանակային ապրանքից հանել (պոպկորն և նմանատիպ) */
export async function sellQuantityStock(
  tx: Tx,
  productId: number,
  quantity: number
) {
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty <= 0) return;

  const decremented = await tx.product.updateMany({
    where: { id: productId, stock: { gte: qty } },
    data: { stock: { decrement: qty } },
  });
  if (decremented.count === 0) {
    throw new Error(UNIT_STOCK_INSUFFICIENT);
  }
}

/** Քանակային ապրանքի պաշար վերադարձնել (չեղարկում) */
export async function returnQuantityStock(
  tx: Tx,
  productId: number,
  quantity: number
) {
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty <= 0) return;

  await tx.product.update({
    where: { id: productId },
    data: { stock: { increment: qty } },
  });
}

/**
 * Վաճառել `quantity` QR միավոր (FIFO՝ ամենահին in_stock)։
 * Միավորները դառնում են `sold`, կապվում `orderItemId`-ին և մնում բազայում։
 */
export async function sellProductUnits(
  tx: Tx,
  productId: number,
  quantity: number,
  orderItemId: number | null
): Promise<string[]> {
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty <= 0) return [];

  const units = await tx.productUnit.findMany({
    where: { productId, status: 'in_stock' },
    orderBy: { createdAt: 'asc' },
    take: qty,
    select: { id: true, qrCode: true },
  });

  if (units.length < qty) {
    throw new Error(UNIT_STOCK_INSUFFICIENT);
  }

  await tx.productUnit.updateMany({
    where: { id: { in: units.map((u) => u.id) } },
    data: { status: 'sold', soldAt: new Date(), orderItemId },
  });

  await syncProductStock(tx, productId);
  return units.map((u) => u.qrCode);
}

/**
 * Վաճառել կոնկրետ սկանավորված միավորները (ID-ներով)։
 * Բոլորը պետք է լինեն `in_stock`, հակառակ դեպքում՝ սխալ (double-sell պաշտպանություն)։
 */
export async function sellSpecificProductUnits(
  tx: Tx,
  unitIds: number[],
  orderItemId: number | null
): Promise<string[]> {
  const ids = Array.from(new Set(unitIds.filter((id) => Number.isFinite(id))));
  if (ids.length === 0) return [];

  const units = await tx.productUnit.findMany({
    where: { id: { in: ids } },
    select: { id: true, productId: true, status: true, qrCode: true },
  });

  if (units.length !== ids.length || units.some((u) => u.status !== 'in_stock')) {
    throw new Error(UNIT_STOCK_INSUFFICIENT);
  }

  await tx.productUnit.updateMany({
    where: { id: { in: ids }, status: 'in_stock' },
    data: { status: 'sold', soldAt: new Date(), orderItemId },
  });

  const productIds = Array.from(new Set(units.map((u) => u.productId)));
  for (const productId of productIds) {
    await syncProductStock(tx, productId);
  }

  return units.map((u) => u.qrCode);
}

/** Վաճառված կոնկրետ միավորը (QR-ով) նշել sold */
export async function sellProductUnitByQr(
  tx: Tx,
  qrCode: string,
  orderItemId: number | null
) {
  const unit = await tx.productUnit.findUnique({
    where: { qrCode: qrCode.trim() },
    select: { id: true, productId: true, status: true },
  });

  if (!unit || unit.status !== 'in_stock') {
    return null;
  }

  await tx.productUnit.update({
    where: { id: unit.id },
    data: { status: 'sold', soldAt: new Date(), orderItemId },
  });

  await syncProductStock(tx, unit.productId);
  return unit;
}

const PEK_REPORTED = 'PEK_REPORTED';

/** Մեկ սկանավորված QR միավոր վերադարձնել պահեստ և թարմացնել պատվերը */
export async function returnSingleProductUnitByQr(tx: Tx, qrCode: string) {
  const code = qrCode.trim();
  if (!code) return null;

  const unit = await tx.productUnit.findUnique({
    where: { qrCode: code },
    include: {
      product: { select: { id: true, name: true } },
      orderItem: {
        include: {
          order: { select: { id: true, totalAmount: true, status: true } },
        },
      },
    },
  });

  if (!unit || unit.status !== 'sold') {
    return null;
  }

  // ՊԵԿ ուղարկված միավորը կարելի է վերադարձնել՝ ՀԴՄ վերադարձի կտրոնով (eMark)։
  // pekReportedAt-ը կմաքրվի ՀԴՄ հաջող պատասխանից հետո։

  const refundAmount = unit.orderItem?.price ?? 0;
  const orderId = unit.orderItem?.orderId ?? null;

  await tx.productUnit.update({
    where: { id: unit.id },
    data: {
      status: 'in_stock',
      soldAt: null,
      orderItemId: null,
      pekReportedAt: null,
    },
  });
  await syncProductStock(tx, unit.productId);

  if (unit.orderItem) {
    const orderItemId = unit.orderItem.id;
    const nextQty = unit.orderItem.quantity - 1;
    if (nextQty <= 0) {
      await tx.orderItem.delete({ where: { id: orderItemId } });
    } else {
      await tx.orderItem.update({
        where: { id: orderItemId },
        data: { quantity: nextQty },
      });
    }

    if (orderId) {
      const remainingItems = await tx.orderItem.count({ where: { orderId } });
      const nextTotal = Math.max(0, unit.orderItem.order.totalAmount - refundAmount);
      await tx.order.update({
        where: { id: orderId },
        data: {
          totalAmount: nextTotal,
          status: remainingItems === 0 ? 'cancelled' : unit.orderItem.order.status,
        },
      });
    }
  }

  return {
    refundAmount,
    productName: unit.product.name,
    qrCode: unit.qrCode,
    orderId,
  };
}

export { PEK_REPORTED };

/**
 * ՀԴՄ-ի հաջող վաճառքից հետո՝ վաճառված միավորները նշել որպես
 * ՊԵԿ ուղարկված (շրջանառությունից դուրս)։
 * Կարող է զտվել orderId-ով և/կամ eMark (QR) ցանկով։
 */
export async function markProductUnitsPekReported(params: {
  orderId?: number | null;
  eMarks?: string[] | null;
  at?: Date;
}): Promise<number> {
  const at = params.at ?? new Date();
  const codes = Array.from(
    new Set(
      (params.eMarks ?? [])
        .map((c) => (c ?? '').trim())
        .filter(Boolean)
    )
  );

  const or: Prisma.ProductUnitWhereInput[] = [];
  if (params.orderId && Number.isFinite(params.orderId)) {
    or.push({ orderItem: { orderId: params.orderId } });
  }
  if (codes.length > 0) {
    or.push({ qrCode: { in: codes } });
  }
  if (or.length === 0) return 0;

  const result = await prisma.productUnit.updateMany({
    where: {
      status: 'sold',
      pekReportedAt: null,
      OR: or,
    },
    data: { pekReportedAt: at },
  });

  return result.count;
}

/**
 * ՀԴՄ վերադարձի հաջող պատասխանից հետո՝ ՊԵԿ նշումը հանել
 * (միավորը կարող է մնալ sold կամ արդեն վերադարձված լինել)։
 */
export async function clearProductUnitsPekReported(params: {
  orderId?: number | null;
  eMarks?: string[] | null;
}): Promise<number> {
  const codes = Array.from(
    new Set(
      (params.eMarks ?? [])
        .map((c) => (c ?? '').trim())
        .filter(Boolean)
    )
  );

  const or: Prisma.ProductUnitWhereInput[] = [];
  if (params.orderId && Number.isFinite(params.orderId)) {
    or.push({ orderItem: { orderId: params.orderId } });
  }
  if (codes.length > 0) {
    or.push({ qrCode: { in: codes } });
  }
  if (or.length === 0) return 0;

  const result = await prisma.productUnit.updateMany({
    where: {
      pekReportedAt: { not: null },
      OR: or,
    },
    data: { pekReportedAt: null },
  });

  return result.count;
}

/** QR միավորները վերադարձնել պահեստ */
export async function returnProductUnitsByOrderItem(
  tx: Tx,
  orderItemId: number
) {
  const units = await tx.productUnit.findMany({
    where: { orderItemId, status: 'sold' },
    select: { id: true, productId: true },
  });

  if (units.length === 0) return;

  await tx.productUnit.updateMany({
    where: { id: { in: units.map((u) => u.id) } },
    data: {
      status: 'in_stock',
      soldAt: null,
      orderItemId: null,
      pekReportedAt: null,
    },
  });

  const productIds = Array.from(new Set(units.map((u) => u.productId)));
  for (const productId of productIds) {
    await syncProductStock(tx, productId);
  }
}

/** Պատվերի տողի պաշարից հանել՝ ըստ ապրանքի տիպի */
export async function fulfillOrderItemStock(
  tx: Tx,
  productId: number,
  category: string,
  quantity: number,
  orderItemId: number | null
): Promise<string[]> {
  if (isQuantityOnlyProduct(category)) {
    await sellQuantityStock(tx, productId, quantity);
    return [];
  }
  return sellProductUnits(tx, productId, quantity, orderItemId);
}

/** Պատվերի տողի պաշար վերադարձնել՝ ըստ ապրանքի տիպի */
export async function returnOrderItemStock(
  tx: Tx,
  orderItemId: number,
  productId: number,
  category: string,
  quantity: number
) {
  if (isQuantityOnlyProduct(category)) {
    await returnQuantityStock(tx, productId, quantity);
  } else {
    await returnProductUnitsByOrderItem(tx, orderItemId);
  }
}
