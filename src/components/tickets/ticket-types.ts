export type TicketStatus =
  | 'reserved'
  | 'awaiting_payment'
  | 'paid'
  | 'used'
  | 'cancelled';

export type TicketsViewFilter = 'upcoming' | 'past' | 'cancelled';

export interface UserTicket {
  id: number;
  price: number;
  status: TicketStatus;
  qrCode?: string | null;
  holdUntil?: Date | string | null;
  createdAt: Date | string;
  screening: {
    id: number;
    startTime: Date | string;
    endTime: Date | string;
    movie: {
      id: number;
      title: string;
      slug?: string | null;
      image?: string | null;
      duration: number;
    };
    hall: {
      id: number;
      name: string;
    };
  };
  seat: {
    id: number;
    row: string;
    number: number;
  };
  order?: {
    id: number;
    paymentMethod?: string | null;
    orderItems: Array<{
      id: number;
      quantity: number;
      price: number;
      ticketId?: number | null;
      product: {
        id: number;
        name: string;
        image?: string | null;
        category: string;
      };
    }>;
  } | null;
}

export interface TicketGroup {
  key: string;
  orderId: number | null;
  paymentMethod: string | null;
  screening: UserTicket['screening'];
  tickets: UserTicket[];
  /** Ամենակարևոր/գործողության կարգավիճակը խմբում */
  status: TicketStatus;
  totalPrice: number;
  holdUntil: Date | string | null;
  orderItems: NonNullable<UserTicket['order']>['orderItems'];
}

const STATUS_PRIORITY: Record<TicketStatus, number> = {
  awaiting_payment: 0,
  reserved: 1,
  paid: 2,
  used: 3,
  cancelled: 4,
};

export function isScreeningPast(
  screening: { endTime: Date | string },
  now = new Date()
): boolean {
  return new Date(screening.endTime).getTime() < now.getTime();
}

export function pickGroupStatus(tickets: UserTicket[]): TicketStatus {
  return [...tickets].sort(
    (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
  )[0]!.status;
}

/** Խմբավորել ըստ պատվեր + ցուցադրություն (կամ առանձին տոմս) */
export function groupUserTickets(tickets: UserTicket[]): TicketGroup[] {
  const map = new Map<string, UserTicket[]>();

  for (const ticket of tickets) {
    const key =
      ticket.order?.id != null
        ? `order-${ticket.order.id}-screening-${ticket.screening.id}`
        : `ticket-${ticket.id}`;
    const list = map.get(key) ?? [];
    list.push(ticket);
    map.set(key, list);
  }

  const groups: TicketGroup[] = [];
  for (const [key, groupTickets] of map) {
    const first = groupTickets[0]!;
    const orderItems = first.order?.orderItems ?? [];
    // Ապրանքներ՝ այս խմբի տոմսերին կապված + պատվերի ընդհանուր
    const ticketIds = new Set(groupTickets.map((t) => t.id));
    const relevantItems = orderItems.filter(
      (item) => item.ticketId == null || ticketIds.has(item.ticketId)
    );

    groups.push({
      key,
      orderId: first.order?.id ?? null,
      paymentMethod: first.order?.paymentMethod ?? null,
      screening: first.screening,
      tickets: groupTickets.sort((a, b) => {
        const row = a.seat.row.localeCompare(b.seat.row, 'hy');
        if (row !== 0) return row;
        return a.seat.number - b.seat.number;
      }),
      status: pickGroupStatus(groupTickets),
      totalPrice:
        groupTickets.reduce((sum, t) => sum + t.price, 0) +
        relevantItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
      holdUntil:
        groupTickets.find((t) => t.holdUntil)?.holdUntil ?? null,
      orderItems: relevantItems,
    });
  }

  return groups.sort(
    (a, b) =>
      new Date(a.screening.startTime).getTime() -
      new Date(b.screening.startTime).getTime()
  );
}

export function filterTicketGroups(
  groups: TicketGroup[],
  filter: TicketsViewFilter,
  now = new Date()
): TicketGroup[] {
  return groups.filter((group) => {
    const past = isScreeningPast(group.screening, now);
    if (filter === 'cancelled') {
      return group.status === 'cancelled';
    }
    if (filter === 'upcoming') {
      return (
        !past &&
        (group.status === 'awaiting_payment' ||
          group.status === 'reserved' ||
          group.status === 'paid')
      );
    }
    // past
    if (group.status === 'cancelled') return false;
    return past || group.status === 'used';
  });
}

export function getNextUpGroup(
  groups: TicketGroup[],
  now = new Date()
): TicketGroup | null {
  const upcoming = filterTicketGroups(groups, 'upcoming', now);
  return upcoming[0] ?? null;
}

export function getGroupQrCode(group: TicketGroup): string {
  if (group.orderId != null) return `ORDER-${group.orderId}`;
  const ticket = group.tickets[0];
  return ticket ? `TICKET-${ticket.id}` : '';
}

export function formatSeatsLabel(group: TicketGroup): string {
  return group.tickets
    .map((t) => `${t.seat.row}${t.seat.number}`)
    .join(' · ');
}
