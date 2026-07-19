/**
 * Նստատեղի hold տրամաբանություն։
 *
 * Օնլայն վճարում (`awaiting_payment`):
 * - Պատվերից հետո տեղը փակ է 5 րոպե (վճարման պատուհան)։
 * - 5 րոպեում չվճարելու դեպքում տոմսը ավտոմատ չեղարկվում է, տեղը բացվում է։
 * - Այդ 5 րոպեում կարելի է փոխել դրամարկղ-ամրագրման (`reserved` + counter)։
 * - `awaiting_payment`-ը վաճառված տոմս չէ. վաճառված է միայն `paid`/`used`
 *   (կամ դրամարկղ `reserved`)։
 *
 * Դրամարկղ-ամրագրում (`reserved` + paymentMethod=counter):
 * - Մնում է զբաղված մինչև վճարում/չեղարկում (առանց 5ր timeout)։
 */
export const RESERVATION_HOLD_MINUTES = 5;
export const RESERVATION_HOLD_MS = RESERVATION_HOLD_MINUTES * 60 * 1000;

/**
 * VPost/gateway էջում գտնվելու ժամանակ hold-ը երկարացվում է այսքանով,
 * որպեսզի 5ր պատուհանը չլրանա քարտ մուտքագրելու ընթացքում։
 */
export const PAYMENT_GATEWAY_HOLD_MINUTES = 15;
export const PAYMENT_GATEWAY_HOLD_MS =
  PAYMENT_GATEWAY_HOLD_MINUTES * 60 * 1000;

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
 * Օնլայն պատվերի ժամանակավոր hold ստատուս՝ «սպասում է վճարման»։
 * vPost հաստատումից հետո → `paid`։ Timeout-ից հետո → `cancelled`։
 */
export const AWAITING_PAYMENT_STATUS = 'awaiting_payment';

/** Կարգավիճակներ, որոնք միշտ զբաղեցնում են տեղը (վերջնական վճարված/օգտագործված)։ */
export const PAID_TICKET_STATUSES = ['paid', 'used'] as const;

/** Online ամրագրման hold-ի ավարտը (ստեղծման պահից +5ր)։ */
export function onlineHoldUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + RESERVATION_HOLD_MS);
}

/** VPost վճարման սկսելիս hold-ի երկարացում (+15ր այս պահից)։ */
export function paymentGatewayHoldUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + PAYMENT_GATEWAY_HOLD_MS);
}

/** Օնլայն վճարման hold-ը դեռ ակտի՞վ է (holdUntil > now)։ */
export function isActivePaymentHold(
  holdUntil: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!holdUntil) return false;
  return new Date(holdUntil).getTime() > now.getTime();
}

/** Մնացած միլիվայրկյաններ մինչև hold-ի ավարտ (0 եթե լրացած)։ */
export function paymentHoldRemainingMs(
  holdUntil: Date | string | null | undefined,
  now: Date = new Date()
): number {
  if (!holdUntil) return 0;
  return Math.max(0, new Date(holdUntil).getTime() - now.getTime());
}

/** Մարդկային մնացած ժամանակ՝ «4:32» կամ «0:05»։ */
export function formatPaymentHoldRemaining(
  holdUntil: Date | string | null | undefined,
  now: Date = new Date()
): string {
  const ms = paymentHoldRemainingMs(holdUntil, now);
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Prisma where-fragment՝ «զբաղված» տոմսերի համար։
 * - paid / used — միշտ
 * - reserved (դրամարկղ) — միշտ
 * - awaiting_payment — միայն եթե holdStill ակտիվ է (holdUntil > now)
 */
export function occupiedTicketWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: { in: [...PAID_TICKET_STATUSES] } },
      { status: 'reserved' },
      {
        status: AWAITING_PAYMENT_STATUS,
        holdUntil: { gt: now },
      },
    ],
  };
}

/**
 * Լրացած օնլայն hold-ներ՝ ավտո-չեղարկման համար։
 */
export function expiredAwaitingPaymentWhere(now: Date = new Date()) {
  return {
    status: AWAITING_PAYMENT_STATUS,
    OR: [{ holdUntil: { lte: now } }, { holdUntil: null }],
  };
}

/** @deprecated օգտագործիր expiredAwaitingPaymentWhere */
export function expiredReservationWhere(now: Date = new Date()) {
  return expiredAwaitingPaymentWhere(now);
}

/** Տոմսը հաշվվում է վաճառվա՞ծ (եկամուտ/վաճառք)։ */
export function isPaidTicketStatus(status: string): boolean {
  return (PAID_TICKET_STATUSES as readonly string[]).includes(status);
}

/**
 * Տոմսը զբաղեցնո՞ւմ է նստատեղը հիմա։
 * awaiting_payment-ի համար՝ եթե holdUntil չի փոխանցվել, ենթադրում ենք
 * որ ցուցակն արդեն ֆիլտրվել է occupiedTicketWhere()-ով։
 */
export function isOccupiedTicketStatus(
  status: string,
  holdUntil?: Date | string | null,
  now: Date = new Date()
): boolean {
  if ((PAID_TICKET_STATUSES as readonly string[]).includes(status)) return true;
  if (status === 'reserved') return true;
  if (status === AWAITING_PAYMENT_STATUS) {
    // holdUntil չփոխանցելիս՝ ենթադրում ենք occupiedTicketWhere ֆիլտր։
    if (holdUntil === undefined) return true;
    return isActivePaymentHold(holdUntil, now);
  }
  return false;
}

/** Տոմսը սպասո՞ւմ է օնլայն վճարման։ */
export function isAwaitingPaymentStatus(status: string): boolean {
  return status === AWAITING_PAYMENT_STATUS;
}

/**
 * Դեռ չվճարված hold ստատուսներ՝ օնլայն awaiting_payment + դրամարկղ reserved։
 */
export const UNPAID_HELD_STATUSES = [
  'reserved',
  AWAITING_PAYMENT_STATUS,
] as const;

export function isUnpaidHeldStatus(status: string): boolean {
  return (UNPAID_HELD_STATUSES as readonly string[]).includes(status);
}

/** Հայերեն պիտակ տոմսի ստատուսի համար։ */
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
