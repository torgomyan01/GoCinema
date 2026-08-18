/** Deterministic AMD price (space thousands) — avoids SSR/client locale mismatch. */
export function formatPrice(value: number): string {
  const n = Math.round(Number(value) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Կինոյի պաշտոնական ժամային գոտի — չի կախված սերվերի/OS TZ-ից */
export const CINEMA_TIMEZONE = 'Asia/Yerevan';

/** Asia/Yerevan = UTC+4, DST չկա 2012-ից */
const YEREVAN_OFFSET_MS = 4 * 60 * 60 * 1000;

const ARMENIAN_MONTHS = [
  'հունվար',
  'փետրվար',
  'մարտ',
  'ապրիլ',
  'մայիս',
  'հունիս',
  'հուլիս',
  'օգոստոս',
  'սեպտեմբեր',
  'հոկտեմբեր',
  'նոյեմբեր',
  'դեկտեմբեր',
] as const;

const ARMENIAN_MONTHS_SHORT = [
  'հնվ',
  'փտվ',
  'մրտ',
  'ապր',
  'մյս',
  'հնս',
  'հլս',
  'օգս',
  'սպտ',
  'հկտ',
  'նմբ',
  'դկտ',
] as const;

const ARMENIAN_WEEKDAYS = [
  'կիրակի',
  'երկուշաբթի',
  'երեքշաբթի',
  'չորեքշաբթի',
  'հինգշաբթի',
  'ուրբաթ',
  'շաբաթ',
] as const;

function parseDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (!s) return new Date(NaN);

  // Արդեն UTC/offset ունի — չենք վերամեկնաբանում
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }

  // YYYY-MM-DD → Երևանի օր, 00:00
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00+04:00`);
  }

  // Naive datetime (առանց TZ) → միշտ Երևան UTC+4, ոչ OS/DST
  const naive = s.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/
  );
  if (naive) {
    const sec = naive[4] ?? '00';
    return new Date(`${naive[1]}T${naive[2]}:${naive[3]}:${sec}+04:00`);
  }

  return new Date(s);
}

/** Երևանի օր/ժամ — միայն ֆիքսված UTC+4, առանց OS/Intl DST */
function yerevanParts(value: Date | string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} | null {
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return null;

  const yerevan = new Date(d.getTime() + YEREVAN_OFFSET_MS);
  return {
    year: yerevan.getUTCFullYear(),
    month: yerevan.getUTCMonth() + 1,
    day: yerevan.getUTCDate(),
    hour: yerevan.getUTCHours(),
    minute: yerevan.getUTCMinutes(),
    weekday: yerevan.getUTCDay(),
  };
}

export type FormatDateHyOptions = {
  weekday?: boolean;
  year?: boolean;
  month?: 'long' | 'short';
};

/** Հայերեն ամսաթիվ — Երևանի ժամային գոտիով */
export function formatDateHy(
  value: Date | string,
  options: FormatDateHyOptions = {}
): string {
  const parts = yerevanParts(value);
  if (!parts) return '';

  const { weekday = false, year = false, month = 'long' } = options;
  const monthName =
    month === 'short'
      ? ARMENIAN_MONTHS_SHORT[parts.month - 1]
      : ARMENIAN_MONTHS[parts.month - 1];
  const datePart = year
    ? `${parts.day} ${monthName} ${parts.year}`
    : `${parts.day} ${monthName}`;

  if (weekday) {
    return `${ARMENIAN_WEEKDAYS[parts.weekday]}, ${datePart}`;
  }

  return datePart;
}

/** Հայերեն ժամ — 24ժ, Երևանի ժամային գոտիով (օր. 19:30) */
export function formatTimeHy(value: Date | string): string {
  const parts = yerevanParts(value);
  if (!parts) return '';
  const hours = String(parts.hour).padStart(2, '0');
  const minutes = String(parts.minute).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Հայերեն ամսաթիվ + ժամ */
export function formatDateTimeHy(
  value: Date | string,
  options: FormatDateHyOptions = { year: true }
): string {
  return `${formatDateHy(value, options)} ${formatTimeHy(value)}`;
}

/** Օրվա բանալի խմբավորման համար (YYYY-MM-DD), Երևանի օրով */
export function formatDateKey(value: Date | string): string {
  const parts = yerevanParts(value);
  if (!parts) return '';
  const m = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${m}-${day}`;
}

/** 0 կիրակի … 6 շաբաթ, Երևանի օրով */
export function getYerevanWeekday(value: Date | string = new Date()): number | null {
  return yerevanParts(value)?.weekday ?? null;
}

/** Շաբաթվա օրվա հայերեն անուն */
export function formatWeekdayHy(value: Date | string): string {
  const parts = yerevanParts(value);
  if (!parts) return '';
  return ARMENIAN_WEEKDAYS[parts.weekday];
}

/**
 * Երևանի օր+ժամ (YYYY-MM-DD + HH:mm) → Date (UTC+4)։
 */
export function yerevanDateTimeToUtc(dateKey: string, timeHy: string): Date {
  const dateParts = dateKey.split('-').map(Number);
  const timeParts = timeHy.split(':').map(Number);
  const y = dateParts[0];
  const m = dateParts[1];
  const d = dateParts[2];
  const hh = timeParts[0];
  const mm = timeParts[1] ?? 0;
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) {
    return new Date(NaN);
  }
  return new Date(`${dateKey}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+04:00`);
}

export function timeHyToMinutes(timeHy: string): number {
  const [hh, mm] = timeHy.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return NaN;
  return hh * 60 + mm;
}

/** Երևանի HH:mm միջակայքերի համընկնում՝ [start, end) */
export function yerevanTimeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  let a0 = timeHyToMinutes(startA);
  let a1 = timeHyToMinutes(endA);
  let b0 = timeHyToMinutes(startB);
  let b1 = timeHyToMinutes(endB);
  if ([a0, a1, b0, b1].some(Number.isNaN)) return false;
  if (a1 <= a0) a1 += 24 * 60;
  if (b1 <= b0) b1 += 24 * 60;
  return a0 < b1 && a1 > b0;
}

/** HH:mm-ը Երևանի [start, end) միջակայքում է */
export function isYerevanTimeWithinRange(
  timeHy: string,
  startHy: string,
  endHy: string
): boolean {
  let t = timeHyToMinutes(timeHy);
  let a0 = timeHyToMinutes(startHy);
  let a1 = timeHyToMinutes(endHy);
  if ([t, a0, a1].some(Number.isNaN)) return false;
  if (a1 <= a0) a1 += 24 * 60;
  if (t < a0 && a1 > 24 * 60) t += 24 * 60;
  return t >= a0 && t < a1;
}

/** HH:mm + րոպեներ → HH:mm (24ժ, առանց timezone) */
export function addMinutesToTimeHy(timeHy: string, minutesToAdd: number): string {
  const [hh, mm] = timeHy.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return '';
  const dayMinutes = 24 * 60;
  let total = hh * 60 + mm + minutesToAdd;
  total = ((total % dayMinutes) + dayMinutes) % dayMinutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** DD.MM.YYYY — Երևանի օրով */
export function formatDateNumericHy(value: Date | string): string {
  const parts = yerevanParts(value);
  if (!parts) return '';
  return `${pad2(parts.day)}.${pad2(parts.month)}.${parts.year}`;
}

export type YerevanWeekRange = {
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
};

/** Երևանի օրացուցային շաբաթ՝ երկուշաբթի 00:00 — կիրակի 23:59:59.999 */
export function getYerevanCalendarWeek(
  now: Date = new Date(),
  which: 'current' | 'previous' = 'previous'
): YerevanWeekRange {
  const parts = yerevanParts(now);
  if (!parts) {
    throw new Error('Invalid date');
  }
  const daysFromMonday = (parts.weekday + 6) % 7;
  const todayStart = new Date(
    `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T00:00:00+04:00`
  );
  const currentMonday = new Date(
    todayStart.getTime() - daysFromMonday * 24 * 60 * 60 * 1000
  );
  const start =
    which === 'previous'
      ? new Date(currentMonday.getTime() - 7 * 24 * 60 * 60 * 1000)
      : currentMonday;
  const nextMonday = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const end = new Date(nextMonday.getTime() - 1);
  return {
    start,
    end,
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
  };
}

/** Երևանի օրերի միջակայք՝ from 00:00 — to 23:59:59.999 */
export function getYerevanDayRange(
  fromKey: string,
  toKey: string
): YerevanWeekRange | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey)) {
    return null;
  }
  const start = new Date(`${fromKey}T00:00:00+04:00`);
  const toStart = new Date(`${toKey}T00:00:00+04:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(toStart.getTime())) {
    return null;
  }
  if (toStart.getTime() < start.getTime()) {
    return null;
  }
  const end = new Date(toStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return {
    start,
    end,
    startKey: fromKey,
    endKey: toKey,
  };
}
