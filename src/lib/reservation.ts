/**
 * Նստատեղի «hold» տրամաբանություն։
 *
 * Տոմս ընտրելուց հետո այն պահվում է (reserved) որոշակի ժամանակ։ Եթե այդ
 * ընթացքում վճարումը չի հաստատվում, ամրագրումը ավտոմատ ազատվում է և տեղը
 * նորից հասանելի է դառնում այլ օգտատերերի համար։
 */
export const RESERVATION_HOLD_MINUTES = 10;
export const RESERVATION_HOLD_MS = RESERVATION_HOLD_MINUTES * 60 * 1000;

/** Կարգավիճակներ, որոնք միշտ զբաղեցնում են տեղը (վերջնական վճարված)։ */
export const PAID_TICKET_STATUSES = ['paid', 'used'] as const;

/** Ամրագրման ժամկետի ստորին սահմանը. այս պահից առաջ ստեղծված reserved-ները լրացած են։ */
export function reservationCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - RESERVATION_HOLD_MS);
}

/** Ստուգում է՝ reserved ամրագրումը դեռ ակտիվ է, թե լրացած։ */
export function isReservationActive(
  createdAt: Date | string,
  now: Date = new Date()
): boolean {
  return new Date(createdAt).getTime() >= reservationCutoff(now).getTime();
}

/**
 * Prisma where-fragment՝ «զբաղված» տոմսերի համար.
 * - paid/used — միշտ
 * - reserved — միայն եթե դեռ չի լրացել hold ժամկետը
 */
export function occupiedTicketWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: { in: [...PAID_TICKET_STATUSES] } },
      { status: 'reserved', createdAt: { gte: reservationCutoff(now) } },
    ],
  };
}

/** Տոմսը հաշվվում է վաճառվա՞ծ (ազատ տեղերի հաշվիչների համար)։ */
export function isPaidTicketStatus(status: string): boolean {
  return (PAID_TICKET_STATUSES as readonly string[]).includes(status);
}
