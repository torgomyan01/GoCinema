import { AGE_RATINGS } from '@/lib/age-rating';
import {
  normalizeReportFrequency,
  PRODUCER_REPORT_FREQUENCIES,
} from '@/lib/producer-report-frequency';

/** JSON-ից լրացվող դաշտեր (առանց նկար / ընկերություն / արտադրող / պայմանագիր) */
export type MovieJsonImportFields = {
  title: string;
  slug: string;
  duration: string;
  ageRating: string;
  genre: string;
  releaseDate: string;
  trailerUrl: string;
  description: string;
  reportFrequency: string;
};

export const MOVIE_JSON_EXAMPLE: MovieJsonImportFields = {
  title: 'Օրինակ ֆիլմ',
  slug: 'orinak-film',
  duration: '120',
  ageRating: '12+',
  genre: 'Դրամա',
  releaseDate: '2026-11-15',
  trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  description:
    'Ֆիլմի կարճ նկարագրություն՝ մոտ 300–350 նիշ։ Այստեղ գրիր սյուժեի հիմնական գաղափարը առանց սփոյլերների, որպեսզի հանդիսատեսը հասկանա տոնը և ժանրը։',
  reportFrequency: 'weekly',
};

function asString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function normalizeReleaseDate(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeAgeRating(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';
  if ((AGE_RATINGS as readonly string[]).includes(raw)) return raw;
  if (/^\d+$/.test(raw) && (AGE_RATINGS as readonly string[]).includes(`${raw}+`)) {
    return `${raw}+`;
  }
  return '';
}

function normalizeDuration(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String(Math.round(value));
  }
  const raw = asString(value);
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.round(n));
}

/**
 * Անվավեր/անհայտ դաշտերը բաց են թողնվում։
 * Նկար, ընկերություն, արտադրող և պայմանագիր չեն կարդացվում։
 */
export function parseMovieJsonImport(raw: unknown): {
  success: boolean;
  error?: string;
  data?: Partial<MovieJsonImportFields>;
} {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, error: 'JSON-ը պետք է լինի օբյեկտ' };
  }

  const obj = raw as Record<string, unknown>;
  const data: Partial<MovieJsonImportFields> = {};

  const title = asString(obj.title);
  if (title) data.title = title;

  const slug = asString(obj.slug);
  if (slug) data.slug = slug;

  const duration = normalizeDuration(obj.duration);
  if (duration) data.duration = duration;

  const ageRating = normalizeAgeRating(obj.ageRating ?? obj.age_rating);
  if (ageRating) data.ageRating = ageRating;

  const genre = asString(obj.genre);
  if (genre) data.genre = genre;

  const releaseDate = normalizeReleaseDate(
    obj.releaseDate ?? obj.release_date
  );
  if (releaseDate) data.releaseDate = releaseDate;

  const trailerUrl = asString(
    obj.trailerUrl ?? obj.trailer_url ?? obj.trailer
  );
  if (trailerUrl) data.trailerUrl = trailerUrl;

  const description = asString(obj.description);
  if (description) data.description = description;

  const freqRaw = asString(obj.reportFrequency ?? obj.report_frequency);
  if (freqRaw) {
    if ((PRODUCER_REPORT_FREQUENCIES as readonly string[]).includes(freqRaw)) {
      data.reportFrequency = freqRaw;
    } else {
      data.reportFrequency = normalizeReportFrequency(freqRaw);
    }
  }

  if (Object.keys(data).length === 0) {
    return {
      success: false,
      error: 'JSON-ում լրացվող դաշտեր չգտնվեցին',
    };
  }

  return { success: true, data };
}

export function downloadMovieJsonExample(): void {
  const blob = new Blob([JSON.stringify(MOVIE_JSON_EXAMPLE, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'movie-example.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
