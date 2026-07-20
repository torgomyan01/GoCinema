/** Ծննդյան ամսաթվի վավերացում և parsing (գրանցում / profile prompt)։ */

const MIN_YEAR = 1920;
const MIN_AGE_YEARS = 5;

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

  const todayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0
  );
  if (date.getTime() > todayUtc) {
    return { ok: false, error: 'Ծննդյան ամսաթիվը չի կարող լինել ապագայում' };
  }

  const minAgeDate = new Date(todayUtc);
  minAgeDate.setUTCFullYear(minAgeDate.getUTCFullYear() - MIN_AGE_YEARS);
  if (date.getTime() > minAgeDate.getTime()) {
    return {
      ok: false,
      error: `Պետք է լինել առնվազն ${MIN_AGE_YEARS} տարեկան`,
    };
  }

  return { ok: true, date };
}

/** `input[type=date]` max արժեք՝ այսօր − MIN_AGE_YEARS։ */
export function birthDateInputMax(now: Date = new Date()): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function birthDateInputMin(): string {
  return `${MIN_YEAR}-01-01`;
}
