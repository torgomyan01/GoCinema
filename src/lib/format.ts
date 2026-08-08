/** Deterministic AMD price (space thousands) — avoids SSR/client locale mismatch. */
export function formatPrice(value: number): string {
  const n = Math.round(Number(value) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Կինոյի պաշտոնական ժամային գոտի — չի կախված սերվերի/OS TZ-ից */
export const CINEMA_TIMEZONE = 'Asia/Yerevan';

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

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function parseDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** Երևանի օր/ժամ — միասնական բոլոր սերվերների/OS-ների համար */
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

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CINEMA_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const hourRaw = Number(get('hour'));
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: hourRaw === 24 ? 0 : hourRaw,
    minute: Number(get('minute')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
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

/** Շաբաթվա օրվա հայերեն անուն */
export function formatWeekdayHy(value: Date | string): string {
  const parts = yerevanParts(value);
  if (!parts) return '';
  return ARMENIAN_WEEKDAYS[parts.weekday];
}

/**
 * Երևանի օր+ժամ (YYYY-MM-DD + HH:mm) → UTC Date։
 * Asia/Yerevan = UTC+4 (DST չկա 2012-ից)։
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
  const YEREVAN_OFFSET_MS = 4 * 60 * 60 * 1000;
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0) - YEREVAN_OFFSET_MS);
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
