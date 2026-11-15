/** Ծննդյան ամսաթվի վավերացում և parsing (գրանցում / profile prompt)։ */

import { formatDateKey } from '@/lib/format';

const MIN_YEAR = 1920;
const MIN_AGE_YEARS = 5;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** MySQL DATE / UTC noon birth date → ամիս+օր (օրացուցային) */
export function getBirthMonthDay(birthDate: Date): {
  month: number;
  day: number;
} {
  return {
    month: birthDate.getUTCMonth() + 1,
    day: birthDate.getUTCDate(),
  };
}

/**
 * Հաջորդ ծնունդը Երևանի օրացույցով (սերվերի TZ-ից անկախ)։
 * `nextBirthdayKey`՝ YYYY-MM-DD, `daysUntil`՝ օրերի տարբերություն։
 */
export function getNextBirthdayMeta(
  birthDate: Date,
  now: Date = new Date()
): {
  daysUntil: number;
  birthdayYear: number;
  nextBirthdayKey: string;
  nextBirthday: Date;
} {
  const { month, day } = getBirthMonthDay(birthDate);
  const todayKey = formatDateKey(now);
  if (!todayKey) {
    throw new Error('Invalid now date');
  }
  const [todayYear] = todayKey.split('-').map(Number);

  const buildKey = (year: number): string => {
    // Փետրվար 29 ոչ-նահանջ տարում → փետրվար 28
    const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day
    ) {
      return `${year}-02-28`;
    }
    return `${year}-${pad2(month)}-${pad2(day)}`;
  };

  let birthdayYear = todayYear;
  let nextBirthdayKey = buildKey(birthdayYear);
  if (nextBirthdayKey < todayKey) {
    birthdayYear += 1;
    nextBirthdayKey = buildKey(birthdayYear);
  }

  const todayNoon = new Date(`${todayKey}T12:00:00+04:00`);
  const nextNoon = new Date(`${nextBirthdayKey}T12:00:00+04:00`);
  const daysUntil = Math.round(
    (nextNoon.getTime() - todayNoon.getTime()) / (24 * 60 * 60 * 1000)
  );

  return {
    daysUntil,
    birthdayYear,
    nextBirthdayKey,
    nextBirthday: new Date(`${nextBirthdayKey}T12:00:00.000Z`),
  };
}

/**
 * Ծննդյան ±windowDays պատուհան (Երևանի օրացույց)՝ տարեվերջ/տարեսկիզբ ներառյալ։
 */
export function getBirthdayWindowMatch(
  birthDate: Date,
  now: Date = new Date(),
  windowDays = 7
): { inWindow: boolean; year: number } {
  const upcoming = getNextBirthdayMeta(birthDate, now);
  if (upcoming.daysUntil <= windowDays) {
    return { inWindow: true, year: upcoming.birthdayYear };
  }

  const { month, day } = getBirthMonthDay(birthDate);
  const todayKey = formatDateKey(now);
  const prevYear = upcoming.birthdayYear - 1;
  const probe = new Date(Date.UTC(prevYear, month - 1, day, 12, 0, 0));
  const prevKey =
    probe.getUTCFullYear() !== prevYear ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
      ? `${prevYear}-02-28`
      : `${prevYear}-${pad2(month)}-${pad2(day)}`;

  const todayNoon = new Date(`${todayKey}T12:00:00+04:00`);
  const prevNoon = new Date(`${prevKey}T12:00:00+04:00`);
  const daysSincePrev = Math.round(
    (todayNoon.getTime() - prevNoon.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (daysSincePrev >= 0 && daysSincePrev <= windowDays) {
    return { inWindow: true, year: prevYear };
  }

  return { inWindow: false, year: upcoming.birthdayYear };
}

/**
 * `YYYY-MM-DD` → Date (կեսօր, timezone shift-ից խուսափելու համար)։
 * Անվավեր դեպքում՝ null։
 */
export function parseBirthDateInput(value: string): Date | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const [y, m, d] = trimmed.split('-').map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }

  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }

  return date;
}

export function validateBirthDate(
  value: string,
  now: Date = new Date()
): { ok: true; date: Date } | { ok: false; error: string } {
  const date = parseBirthDateInput(value);
  if (!date) {
    return { ok: false, error: 'Մուտքագրեք վավեր ծննդյան ամսաթիվ' };
  }

  const year = date.getUTCFullYear();
  if (year < MIN_YEAR) {
    return { ok: false, error: 'Ծննդյան ամսաթիվը անվավեր է' };
  }

  const todayKey = formatDateKey(now);
  if (!todayKey) {
    return { ok: false, error: 'Մուտքագրեք վավեր ծննդյան ամսաթիվ' };
  }
  const todayNoon = new Date(`${todayKey}T12:00:00.000Z`);
  if (date.getTime() > todayNoon.getTime()) {
    return { ok: false, error: 'Ծննդյան ամսաթիվը չի կարող լինել ապագայում' };
  }

  const [ty, tm, td] = todayKey.split('-').map(Number);
  const minAgeDate = new Date(Date.UTC(ty - MIN_AGE_YEARS, tm - 1, td, 12, 0, 0));
  if (date.getTime() > minAgeDate.getTime()) {
    return {
      ok: false,
      error: `Պետք է լինել առնվազն ${MIN_AGE_YEARS} տարեկան`,
    };
  }

  return { ok: true, date };
}

/** `input[type=date]` max արժեք՝ այսօր − MIN_AGE_YEARS (Երևան)։ */
export function birthDateInputMax(now: Date = new Date()): string {
  const todayKey = formatDateKey(now);
  if (!todayKey) return `${MIN_YEAR}-01-01`;
  const [ty, tm, td] = todayKey.split('-').map(Number);
  return `${ty - MIN_AGE_YEARS}-${pad2(tm)}-${pad2(td)}`;
}

export function birthDateInputMin(): string {
  return `${MIN_YEAR}-01-01`;
}
