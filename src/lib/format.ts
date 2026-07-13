/** Deterministic AMD price (space thousands) — avoids SSR/client locale mismatch. */
export function formatPrice(value: number): string {
  const n = Math.round(Number(value) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

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
  return typeof value === 'string' ? new Date(value) : value;
}

export type FormatDateHyOptions = {
  weekday?: boolean;
  year?: boolean;
  month?: 'long' | 'short';
};

/** Հայերեն ամսաթիվ — չի կախված սարքի locale-ից (Windows/Russian fallback չկա) */
export function formatDateHy(
  value: Date | string,
  options: FormatDateHyOptions = {}
): string {
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return '';

  const { weekday = false, year = false, month = 'long' } = options;
  const monthName =
    month === 'short'
      ? ARMENIAN_MONTHS_SHORT[d.getMonth()]
      : ARMENIAN_MONTHS[d.getMonth()];
  const datePart = year
    ? `${d.getDate()} ${monthName} ${d.getFullYear()}`
    : `${d.getDate()} ${monthName}`;

  if (weekday) {
    return `${ARMENIAN_WEEKDAYS[d.getDay()]}, ${datePart}`;
  }

  return datePart;
}

/** Հայերեն ժամ — 24ժ ֆորմատ (օր. 19:30) */
export function formatTimeHy(value: Date | string): string {
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Հայերեն ամսաթիվ + ժամ */
export function formatDateTimeHy(
  value: Date | string,
  options: FormatDateHyOptions = { year: true }
): string {
  return `${formatDateHy(value, options)} ${formatTimeHy(value)}`;
}

/** Օրվա բանալի խմբավորման համար (YYYY-MM-DD) */
export function formatDateKey(value: Date | string): string {
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Շաբաթվա օրվա հայերեն անուն */
export function formatWeekdayHy(value: Date | string): string {
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return '';
  return ARMENIAN_WEEKDAYS[d.getDay()];
}
