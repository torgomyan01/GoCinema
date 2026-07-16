/**
 * Նստատեղի «hold» տրամաբանություն։
 *
 * Տոմս ընտրելուց հետո այն պահվում է (reserved) և ավտոմատ չի չեղարկվում։
 * Հաճախորդը կարող է վճարել/սպասարկվել դրամարկղում, իսկ QR-ը մնում է հասանելի։
 *
 * `holdUntil` դաշտը legacy/տեղեկատվական է. այն այլևս չի որոշում, թե
 * տոմսը չեղարկվի՞, QR-ը թաքնվի՞, թե նստատեղը ազատվի՞։
 */
export const RESERVATION_HOLD_MINUTES = 10;
export const RESERVATION_HOLD_MS = RESERVATION_HOLD_MINUTES * 60 * 1000;

/** Order.paymentMethod-ի արժեքը՝ դրամարկղում վճարվող ամրագրումների համար։ */
export const COUNTER_PAYMENT_METHOD = 'counter';

/** Legacy արժեք. QR/սպասարկման հասանելիության վրա այլևս չի ազդում։ */
export const COUNTER_SERVICE_GRACE_MS = 24 * 60 * 60 * 1000;

/** Legacy hold-ի ավարտը = ցուցադրության ավարտ + 24 ժամ։ */
export function counterHoldUntil(screeningEnd: Date | string): Date {
  return new Date(
    new Date(screeningEnd).getTime() + COUNTER_SERVICE_GRACE_MS
  );
}

/** Անվճար (դրամարկղ) ամրագրման առավելագույն աթոռների քանակ՝ մեկ հաշվի վրա։ */
export const MAX_FREE_RESERVED_SEATS = 4;

/**
 * Օնլайն պատվերի տոմսի սկզբնական ստատուս՝ «սպասում է վճարման»։
 * Տեղը պահվում է, բայց դեռ վճարված չէ։ vPost-ի հաստատումից հետո դառնում է `paid`։
 * Դրամարկղ-ամրագրումը մնում է `reserved` (վճարվում է մուտքի մոտ)։
 */
export const AWAITING_PAYMENT_STATUS = 'awaiting_payment';

/** Կարգավիճակներ, որոնք միշտ զբաղեցնում են տեղը (վերջնական վճարված)։ */
export const PAID_TICKET_STATUSES = ['paid', 'used'] as const;
export const OCCUPIED_TICKET_STATUSES = [
  'reserved',
  AWAITING_PAYMENT_STATUS,
  'paid',
  'used',
] as const;

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
 * Prisma where-fragment՝ «զբաղված» տոմսերի համար։
 * Reserved տոմսերն այլևս ժամկետով չեն ազատվում. միայն manual cancelled-ը
 * կարող է նորից ազատել նստատեղը։
 */
export function occupiedTicketWhere(_now: Date = new Date()) {
  return {
    OR: [
      { status: { in: [...PAID_TICKET_STATUSES] } },
      { status: 'reserved' },
      { status: AWAITING_PAYMENT_STATUS },
    ],
  };
}

/**
 * Reserved տոմսերի ավտոմատ լրացում/ազատում այլևս չկա։
 */
export function expiredReservationWhere(_now: Date = new Date()) {
  return {
    status: 'reserved',
    id: -1,
  };
}

/** Տոմսը հաշվվում է վաճառվա՞ծ (ազատ տեղերի հաշվիչների համար)։ */
export function isPaidTicketStatus(status: string): boolean {
  return (PAID_TICKET_STATUSES as readonly string[]).includes(status);
}

/** Տոմսը զբաղեցնո՞ւմ է նստատեղը։ */
export function isOccupiedTicketStatus(status: string): boolean {
  return (OCCUPIED_TICKET_STATUSES as readonly string[]).includes(status);
}

/** Տոմսը սպասո՞ւմ է օնլայն վճարման (ամրագրված է, բայց դեռ չվճարված)։ */
export function isAwaitingPaymentStatus(status: string): boolean {
  return status === AWAITING_PAYMENT_STATUS;
}

/**
 * Դեռ չվճարված (բայց տեղը զբաղեցնող) ստատուսներ՝ օնլайն «սպասում է վճարման» +
 * դրամարկղ «ամրագրված»։ Օգտագործվում է վճարման/տեղափոխման տրամաբանության մեջ։
 */
export const UNPAID_HELD_STATUSES = [
  'reserved',
  AWAITING_PAYMENT_STATUS,
] as const;

/** Տոմսը դեռ չվճարված ամրագրո՞ւմ է (reserved կամ awaiting_payment)։ */
export function isUnpaidHeldStatus(status: string): boolean {
  return (UNPAID_HELD_STATUSES as readonly string[]).includes(status);
}

/** Հայերեն պիտակ տոմսի ստատուսի համար (հաճախորդ + ադմին)։ */
export function ticketStatusLabelHy(status: string): string {
  switch (status) {
    case 'paid':
      return 'Վճարված';
    case 'awaiting_payment':
      return 'Սպասում է վճարման';
    case 'reserved':
      return 'Ամրագրված';
    case 'used':
      return 'Օգտագործված';
    case 'cancelled':
      return 'Չեղարկված';
    default:
      return status;
  }
}
