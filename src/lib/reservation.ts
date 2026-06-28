/**
 * Նստատեղի «hold» տրամաբանություն։
 *
 * Տոմս ընտրելուց հետո այն պահվում է (reserved) որոշակի ժամանակ։ Եթե այդ
 * ընթացքում վճարումը չի հաստատվում, ամրագրումը ավտոմատ ազատվում է և տեղը
 * նորից հասանելի է դառնում այլ օգտատերերի համար։
 *
 * Երկու տեսակի ամրագրում.
 *  - Online (վճարում քարտով/Telcell)՝ կարճ hold (RESERVATION_HOLD_MINUTES)։
 *  - Դրամարկղ-ամրագրում (paymentMethod = "counter")՝ hold-ը մինչև
 *    ցուցադրության սկիզբը. հաճախորդը գալիս ու վճարում է դրամարկղում։
 *
 * `holdUntil` դաշտը պահում է ամրագրման ավարտի ճշգրիտ պահը։ Հին (legacy)
 * տոմսերի համար, որտեղ `holdUntil = null`, ընկնում ենք createdAt + 10ր
 * տրամաբանությանը։
 */
export const RESERVATION_HOLD_MINUTES = 10;
export const RESERVATION_HOLD_MS = RESERVATION_HOLD_MINUTES * 60 * 1000;

/** Order.paymentMethod-ի արժեքը՝ դրամարկղում վճարվող ամրագրումների համար։ */
export const COUNTER_PAYMENT_METHOD = 'counter';

/** Անվճար (դրամարկղ) ամրագրման առավելագույն աթոռների քանակ՝ մեկ հաշվի վրա։ */
export const MAX_FREE_RESERVED_SEATS = 4;

/** Կարգավիճակներ, որոնք միշտ զբաղեցնում են տեղը (վերջնական վճարված)։ */
export const PAID_TICKET_STATUSES = ['paid', 'used'] as const;

/** Ամրագրման ժամկետի ստորին սահմանը. այս պահից առաջ ստեղծված reserved-ները լրացած են։ */
export function reservationCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - RESERVATION_HOLD_MS);
}

/** Online ամրագրման hold-ի ավարտը (ստեղծման պահից +10ր)։ */
export function onlineHoldUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + RESERVATION_HOLD_MS);
}

/** Ստուգում է՝ reserved ամրագրումը դեռ ակտիվ է, թե լրացած (legacy createdAt-ով)։ */
export function isReservationActive(
  createdAt: Date | string,
  now: Date = new Date()
): boolean {
  return new Date(createdAt).getTime() >= reservationCutoff(now).getTime();
}

/**
 * Prisma where-fragment՝ «զբաղված» տոմսերի համար.
 * - paid/used — միշտ
 * - reserved + holdUntil դեռ չի անցել — ակտիվ hold (online կամ դրամարկղ)
 * - reserved + holdUntil = null (legacy) — createdAt-ը դեռ թարմ է
 */
export function occupiedTicketWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: { in: [...PAID_TICKET_STATUSES] } },
      { status: 'reserved', holdUntil: { gte: now } },
      {
        status: 'reserved',
        holdUntil: null,
        createdAt: { gte: reservationCutoff(now) },
      },
    ],
  };
}

/**
 * Prisma where-fragment՝ լրացած (ազատման ենթակա) reserved տոմսերի համար։
 */
export function expiredReservationWhere(now: Date = new Date()) {
  return {
    status: 'reserved',
    OR: [
      { holdUntil: { lt: now } },
      { holdUntil: null, createdAt: { lt: reservationCutoff(now) } },
    ],
  };
}

/** Տոմսը հաշվվում է վաճառվա՞ծ (ազատ տեղերի հաշվիչների համար)։ */
export function isPaidTicketStatus(status: string): boolean {
  return (PAID_TICKET_STATUSES as readonly string[]).includes(status);
}
