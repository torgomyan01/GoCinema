import { isQuantityOnlyProduct } from '@/lib/product-units';

export type PreOrderLine = {
  id: number;
  quantity: number;
  price?: number;
  fulfilledAt?: string | Date | null;
  product: { name: string; category: string };
  units?: Array<{ qrCode: string; status: string }>;
  ticketId?: number | null;
};

export type TicketWithPreOrder = {
  id: number;
  status: string;
  orderItems?: PreOrderLine[];
  seat?: { row?: string | null; number?: string | number | null } | null;
};

export type AggregatedOrderProductLine = PreOrderLine & {
  ticketId: number;
  ticketStatus: string;
  seatLabel: string;
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

function seatLabelOf(ticket: TicketWithPreOrder): string {
  const row = ticket.seat?.row ?? '';
  const num = ticket.seat?.number ?? '';
  return `${row}${num}`.trim();
}

/** Պատվերի բոլոր տոմսերի ապրանքները՝ մեկ ցանկում */
export function collectOrderProductLines(
  tickets: TicketWithPreOrder[]
): AggregatedOrderProductLine[] {
  const lines: AggregatedOrderProductLine[] = [];
  for (const ticket of tickets) {
    if (ticket.status === 'cancelled') continue;
    for (const item of ticket.orderItems ?? []) {
      lines.push({
        ...item,
        ticketId: Number(ticket.id),
        ticketStatus: ticket.status,
        seatLabel: seatLabelOf(ticket),
      });
    }
  }
  return lines;
}

export function orderNeedsQrScan(tickets: TicketWithPreOrder[]): boolean {
  return tickets.some((t) => ticketNeedsQrScan(t));
}

export function orderQrScanProgress(tickets: TicketWithPreOrder[]): {
  done: number;
  total: number;
} {
  return tickets.reduce(
    (acc, ticket) => {
      if (ticket.status !== 'paid' && ticket.status !== 'reserved') return acc;
      const p = ticketQrScanProgress(ticket);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 }
  );
}

/**
 * Մոդալի համար՝ պատվերի բոլոր QR ապրանքները մեկ «վիրտուալ» տոմսում։
 * id = առաջին տոմսի id (lookup-ը orderId-ով է արվում), _orderId նշում է պատվերի ռեժիմը։
 */
export function buildOrderScanAggregate(
  orderId: number,
  tickets: TicketWithPreOrder[]
): TicketWithPreOrder & {
  _orderId: number;
  _orderScan: true;
} {
  const scannable = tickets.filter(
    (t) =>
      (t.status === 'paid' || t.status === 'reserved') &&
      getQrOrderItems(t).length > 0
  );
  const orderItems = scannable.flatMap((t) =>
    getQrOrderItems(t).map((item) => ({
      ...item,
      ticketId: Number(t.id),
    }))
  );
  const hasReserved = scannable.some((t) => t.status === 'reserved');
  const primary = scannable[0] ?? tickets[0];

  return {
    id: Number(primary?.id ?? 0),
    status: hasReserved ? 'reserved' : 'paid',
    orderItems,
    _orderId: orderId,
    _orderScan: true,
  };
}
