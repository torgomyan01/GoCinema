import type {
  InstagramStoryMovie,
  SmmPremiere,
} from '@/app/actions/instagram-story';
import {
  formatDuration,
  formatSessionLine,
  formatTimesLine,
  fullDateLabel,
  groupScreenings,
  moviePublicUrl,
  premiereCountdown,
} from '@/lib/smm-canvas';
import { moviesPlayingToday } from '@/lib/smm-today-render';

const HASHTAGS =
  '#GoCinema #կինո #Երևան #կինոթատրոն #տոմսեր #gocinema';

function movieMeta(movie: InstagramStoryMovie): string {
  return [movie.genre, movie.ageRating, formatDuration(movie.duration)]
    .filter(Boolean)
    .join(' · ');
}

export function captionForMovie(movie: InstagramStoryMovie): string {
  const lines = groupScreenings(movie.screenings).map(formatSessionLine);
  const shown = lines.slice(0, 8);
  const extra =
    lines.length > shown.length ? `\n+${lines.length - shown.length} օր ևս` : '';

  return [
    `🎬 ${movie.title}`,
    movieMeta(movie),
    '',
    '📅 Սեանսներ',
    shown.join('\n') + extra,
    '',
    `Տոմսեր՝ ${moviePublicUrl(movie.slug, movie.id)}`,
    '',
    HASHTAGS,
  ].join('\n');
}

export function captionForToday(movies: InstagramStoryMovie[]): string {
  const today = moviesPlayingToday(movies);
  const blocks = today.map((movie) => {
    const group = groupScreenings(movie.screenings)[0];
    const times = group ? formatTimesLine(group.times) : '';
    return `• ${movie.title}${movie.ageRating ? ` (${movie.ageRating})` : ''} — ${times}`;
  });

  return [
    '🎥 Այսօր GoCinema-ում',
    '',
    ...blocks,
    '',
    'Տոմսեր՝ https://gocinema.am/schedule',
    '',
    HASHTAGS,
  ].join('\n');
}

export function captionForPremiere(premiere: SmmPremiere): string {
  const movie = premiere.movie;
  const date = new Date(premiere.premiereDate);
  const blurb = premiere.description || movie.description;
  const lines = groupScreenings(movie.screenings)
    .map(formatSessionLine)
    .slice(0, 6);

  const parts = [
    `✨ Պրեմիերա · ${premiereCountdown(date)}`,
    '',
    `🎬 ${movie.title}`,
    movieMeta(movie),
    `📅 ${fullDateLabel(date)}`,
  ];

  if (blurb) {
    parts.push('', blurb.trim());
  }
  if (lines.length > 0) {
    parts.push('', 'Սեանսներ', ...lines);
  }
  parts.push(
    '',
    `Տոմսեր՝ ${moviePublicUrl(movie.slug, movie.id)}`,
    '',
    HASHTAGS
  );
  return parts.join('\n');
}

export function captionForSchedule(movies: InstagramStoryMovie[]): string {
  const blocks = movies.slice(0, 5).map((movie) => {
    const lines = groupScreenings(movie.screenings)
      .map(formatSessionLine)
      .slice(0, 4);
    return `🎬 ${movie.title}\n${lines.join('\n')}`;
  });

  return [
    '📅 GoCinema · ժամանակացույց',
    '',
    ...blocks,
    '',
    'Տոմսեր՝ https://gocinema.am/schedule',
    '',
    HASHTAGS,
  ].join('\n');
}
