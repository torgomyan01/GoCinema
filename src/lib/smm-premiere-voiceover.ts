import type { SmmPremiere } from '@/app/actions/instagram-story';
import { rewriteForArmenianSpeech } from '@/lib/armenian-speech';
import { MONTH_FULL } from '@/lib/smm-canvas';
import { formatDateKey } from '@/lib/format';

function ticketPriceAmd(premiere: SmmPremiere): number {
  const prices = premiere.movie.screenings
    .map((row) => Math.round(row.price))
    .filter((price) => price > 0);
  if (prices.length === 0) return 1000;
  const counts = new Map<number, number>();
  for (const price of prices) {
    counts.set(price, (counts.get(price) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

/** Երևանի օրով՝ «Օգոստոսի 20 ից» */
export function premiereFromPhrase(premiereDate: string): string {
  const key = formatDateKey(premiereDate);
  const parts = key.split('-').map(Number);
  const month = parts[1];
  const day = parts[2];
  if (!month || !day) return 'շուտով';
  const monthName = MONTH_FULL[month - 1] || '';
  const capitalized = monthName
    ? monthName.charAt(0).toUpperCase() + monthName.slice(1)
    : '';
  return `${capitalized} ${day} ից`;
}

export function stripAudioTags(text: string): string {
  return text
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Վաճառող տեքստ (մաքուր, սուբտիտրի և խմբագրման համար)։
 */
export function salesVoiceoverForPremiere(premiere: SmmPremiere): string {
  const title = premiere.movie.title.trim();
  const price = ticketPriceAmd(premiere);
  const from = premiereFromPhrase(premiere.premiereDate);
  return [
    `${title} ֆիլմը արդեն Մարտունիում։`,
    `Տոմսերի արժեքը ${price} դրամ։`,
    `${from} GoCinema կինոթատրոնում։`,
  ].join('\n\n');
}

/**
 * Eleven v3-ին ուղարկվող տեքստ՝ հայերեն արտասանությամբ։
 * Tag չենք դնում, որ մոդելը անգլերենի չանցնի։
 */
export function toMovieTrailerTts(text: string): string {
  const lines = stripAudioTags(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return rewriteForArmenianSpeech(text.trim());
  return lines.map((line) => rewriteForArmenianSpeech(line)).join('\n');
}

export function salesCaptionForPremiere(premiere: SmmPremiere): string {
  const title = premiere.movie.title.trim();
  const price = ticketPriceAmd(premiere);
  const from = premiereFromPhrase(premiere.premiereDate);
  return [
    `${title} ֆիլմը արդեն Մարտունիում։`,
    `Տոմսերի արժեքը ${price} դրամ։`,
    `${from} GoCinema կինոթատրոնում։`,
    '',
    'https://gocinema.am',
    '',
    '#GoCinema #կինո #Մարտունի #պրեմիերա #տոմսեր',
  ].join('\n');
}

export type SubtitleCue = {
  text: string;
  start: number;
  end: number;
};

export function subtitleCuesFromVoiceover(
  text: string,
  alignment?: {
    characters?: string[];
    character_start_times_seconds?: number[];
    character_end_times_seconds?: number[];
  } | null,
  fallbackDuration = 12
): SubtitleCue[] {
  const lines = text
    .split(/\n+/)
    .map((line) => stripAudioTags(line).trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const aligned = alignment?.character_end_times_seconds?.at(-1);
  const total =
    Number.isFinite(aligned) && (aligned as number) > 0.4
      ? (aligned as number)
      : fallbackDuration;
  const slice = total / lines.length;
  return lines.map((line, i) => ({
    text: line,
    start: i * slice,
    end: i === lines.length - 1 ? total + 0.25 : (i + 1) * slice,
  }));
}
