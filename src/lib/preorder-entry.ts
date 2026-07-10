import { isQuantityOnlyProduct } from '@/lib/product-units';

export type PreOrderLine = {
  id: number;
  quantity: number;
  fulfilledAt?: string | Date | null;
  product: { name: string; category: string };
  units?: Array<{ qrCode: string; status: string }>;
};

export type TicketWithPreOrder = {
  id: number;
  status: string;
  orderItems?: PreOrderLine[];
};

export function getQrOrderItems(ticket: TicketWithPreOrder): PreOrderLine[] {
  return (ticket.orderItems ?? []).filter(
    (item) =>
      !item.fulfilledAt &&
      !isQuantityOnlyProduct(item.product?.category ?? '')
  );
}

export function countReservedQrs(item: PreOrderLine): number {
  return (
    item.units?.filter((u) => u.status === 'in_stock').length ?? 0
  );
}

export function countSoldQrs(item: PreOrderLine): number {
  return item.units?.filter((u) => u.status === 'sold').length ?? 0;
}

export function countAttachedQrs(item: PreOrderLine): number {
  return Math.max(countReservedQrs(item), countSoldQrs(item));
}

export function isQrLineReady(item: PreOrderLine): boolean {
  return countAttachedQrs(item) >= item.quantity;
}

export function ticketNeedsQrScan(ticket: TicketWithPreOrder): boolean {
  // Վճարված տոմս՝ սկան + մուտք; ամրագրված (դեռ չվճարված)՝ սկան + կցում,
  // վերջնականացումը դրամարկղում վճարելիս
  if (ticket.status !== 'paid' && ticket.status !== 'reserved') return false;
  const lines = getQrOrderItems(ticket);
  return lines.some((item) => !isQrLineReady(item));
}

export function ticketQrScanProgress(ticket: TicketWithPreOrder): {
  done: number;
  total: number;
} {
  const lines = getQrOrderItems(ticket);
  const total = lines.reduce((sum, item) => sum + item.quantity, 0);
  const done = lines.reduce((sum, item) => {
    return sum + Math.min(countAttachedQrs(item), item.quantity);
  }, 0);
  return { done, total };
}

export function isTicketQrReady(ticket: TicketWithPreOrder): boolean {
  return !ticketNeedsQrScan(ticket);
}
