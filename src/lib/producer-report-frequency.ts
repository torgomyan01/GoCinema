import {
  formatDateKey,
  getYerevanCalendarWeek,
  getYerevanDayRange,
  getYerevanPreviousCalendarMonth,
  shiftYerevanDateKey,
  type YerevanWeekRange,
} from '@/lib/format';

export const PRODUCER_REPORT_FREQUENCIES = [
  'daily',
  'every_3_days',
  'weekly',
  'monthly',
] as const;

export type ProducerReportFrequency =
  (typeof PRODUCER_REPORT_FREQUENCIES)[number];

export const PRODUCER_REPORT_FREQUENCY_LABELS: Record<
  ProducerReportFrequency,
  string
> = {
  daily: 'Ամեն օր',
  every_3_days: 'Ամեն 3 օրը մեկ',
  weekly: 'Ամեն շաբաթ',
  monthly: 'Ամեն ամիս',
};

export function normalizeReportFrequency(
  value: string | null | undefined
): ProducerReportFrequency {
  if (
    value &&
    (PRODUCER_REPORT_FREQUENCIES as readonly string[]).includes(value)
  ) {
    return value as ProducerReportFrequency;
  }
  return 'weekly';
}

/** 3-օրյա բլոկների խարիսխ՝ Երևանի օրացույցով */
const THREE_DAY_EPOCH = '2020-01-01';

export type DueProducerReportPeriod = YerevanWeekRange & {
  /** Այսօր պետք է փորձել ուղարկել այս ժամանակահատվածը */
  due: boolean;
  frequency: ProducerReportFrequency;
};

/**
 * Ավարտված ժամանակահատված՝ ըստ հաճախության։
 * - daily → երեկ
 * - every_3_days → վերջին լրիվ 3 օր (միայն բլոկի հաջորդ օրը due)
 * - weekly → նախորդ երկուշաբթի–կիրակի
 * - monthly → նախորդ օրացուցային ամիս
 */
export function getDueProducerReportPeriod(
  frequencyRaw: string | null | undefined,
  now: Date = new Date()
): DueProducerReportPeriod {
  const frequency = normalizeReportFrequency(frequencyRaw);
  const todayKey = formatDateKey(now);
  const yesterdayKey = shiftYerevanDateKey(todayKey, -1);

  if (frequency === 'daily') {
    const range = getYerevanDayRange(yesterdayKey, yesterdayKey);
    if (!range) throw new Error('Invalid daily range');
    return { ...range, due: true, frequency };
  }

  if (frequency === 'every_3_days') {
    const epoch = new Date(`${THREE_DAY_EPOCH}T00:00:00+04:00`);
    const yesterday = new Date(`${yesterdayKey}T00:00:00+04:00`);
    const daysSinceEpoch = Math.floor(
      (yesterday.getTime() - epoch.getTime()) / (24 * 60 * 60 * 1000)
    );
    const blockIndex = Math.floor(Math.max(0, daysSinceEpoch) / 3);
    const blockStartKey = shiftYerevanDateKey(THREE_DAY_EPOCH, blockIndex * 3);
    const blockEndKey = shiftYerevanDateKey(blockStartKey, 2);
    const sendDayKey = shiftYerevanDateKey(blockEndKey, 1);
    const range = getYerevanDayRange(blockStartKey, blockEndKey);
    if (!range) throw new Error('Invalid 3-day range');
    return {
      ...range,
      due: todayKey === sendDayKey,
      frequency,
    };
  }

  if (frequency === 'monthly') {
    const range = getYerevanPreviousCalendarMonth(now);
    return { ...range, due: true, frequency };
  }

  // weekly
  const range = getYerevanCalendarWeek(now, 'previous');
  return { ...range, due: true, frequency };
}
