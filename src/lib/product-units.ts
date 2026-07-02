import type { Prisma } from '@prisma/client';

/**
 * ProductUnit-ների կառավարման ընդհանուր օգնականներ։
 *
 * Ամեն ֆիզիկական ապրանք ունի իր ունիկալ QR-ով ProductUnit գրառումը։
 * Վաճառքի ժամանակ միավորը դառնում է `sold` (չի ջնջվում՝ հարկային հաշվառման համար),
 * իսկ `product.stock`-ը միշտ համաժամեցվում է `in_stock` միավորների քանակին։
 */

type Tx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Սխալ, երբ պահեստում բավարար in_stock միավոր չկա */
export const UNIT_STOCK_INSUFFICIENT = 'UNIT_STOCK_INSUFFICIENT';

/** Համաժամեցնել product.stock = in_stock միավորների քանակ */
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

/**
 * Վաճառել `quantity` միավոր (FIFO՝ ամենահին in_stock)։
 * Միավորները դառնում են `sold`, կապվում `orderItemId`-ին և մնում բազայում։
 * Եթե բավարար միավոր չկա՝ throw UNIT_STOCK_INSUFFICIENT։
 */
export async function sellProductUnits(
  tx: Tx,
  productId: number,
  quantity: number,
  orderItemId: number | null
) {
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty <= 0) return;

  const units = await tx.productUnit.findMany({
    where: { productId, status: 'in_stock' },
    orderBy: { createdAt: 'asc' },
    take: qty,
    select: { id: true },
  });

  if (units.length < qty) {
    throw new Error(UNIT_STOCK_INSUFFICIENT);
  }

  await tx.productUnit.updateMany({
    where: { id: { in: units.map((u) => u.id) } },
    data: { status: 'sold', soldAt: new Date(), orderItemId },
  });

  await syncProductStock(tx, productId);
}

/**
 * Վաճառված կոնկրետ միավորը (QR-ով) նշել sold և կապել պատվերին։
 * Օգտագործվում է վաճառքի/մուտքի պահին QR սկանավորելիս։
 * Վերադարձնում է միավորը կամ null (եթե չկա/արդեն վաճառված)։
 */
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

/**
 * Վերադարձնել պատվերի տողին կապված վաճառված միավորները պահեստ (in_stock)։
 * Օգտագործվում է չեղարկման/վերադարձի ժամանակ։
 */
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
    data: { status: 'in_stock', soldAt: null, orderItemId: null },
  });

  const productIds = Array.from(new Set(units.map((u) => u.productId)));
  for (const productId of productIds) {
    await syncProductStock(tx, productId);
  }
}
