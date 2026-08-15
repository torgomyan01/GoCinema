import type { InstagramStoryMovie } from '@/app/actions/instagram-story';
import {
  FONT,
  STORY_HEIGHT,
  STORY_WIDTH,
  dayLabel,
  drawCover,
  fillBrandBackground,
  formatTimesLine,
  groupScreenings,
  isSameDay,
  loadImage,
  roundRect,
} from '@/lib/smm-canvas';

export function todaysScreenings(movie: InstagramStoryMovie, now = new Date()) {
  return movie.screenings.filter((row) => isSameDay(new Date(row.startTime), now));
}

export function moviesPlayingToday(
  movies: InstagramStoryMovie[],
  now = new Date()
): InstagramStoryMovie[] {
  return movies
    .map((movie) => ({
      ...movie,
      screenings: todaysScreenings(movie, now),
    }))
    .filter((movie) => movie.screenings.length > 0);
}

export async function renderTodayStory(
  canvas: HTMLCanvasElement,
  movies: InstagramStoryMovie[]
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  fillBrandBackground(ctx, STORY_WIDTH, STORY_HEIGHT);

  const today = new Date();
  ctx.fillStyle = '#e8c547';
  ctx.font = `700 42px ${FONT}`;
  ctx.fillText('GOCINEMA', 64, 92);
  ctx.fillStyle = '#f4f4f5';
  ctx.font = `600 54px ${FONT}`;
  ctx.fillText('Այսօր կինոյում', 64, 158);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText(`${dayLabel(today)} · ժամեր և գին`, 64, 204);

  const top = 240;
  const bottom = 1840;
  const gap = 16;
  const count = Math.max(movies.length, 1);
  const cardH = (bottom - top - gap * (count - 1)) / count;
  const posterW = 150;
  const posterH = Math.min(210, cardH - 32);

  const images = await Promise.all(
    movies.map((movie) =>
      movie.image ? loadImage(movie.image) : Promise.resolve(null)
    )
  );

  movies.forEach((movie, index) => {
    const y = top + index * (cardH + gap);
    ctx.fillStyle = 'rgba(22, 22, 31, 0.92)';
    roundRect(ctx, 48, y, STORY_WIDTH - 96, cardH, 26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 197, 71, 0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const posterX = 72;
    const posterY = y + (cardH - posterH) / 2;
    ctx.save();
    roundRect(ctx, posterX, posterY, posterW, posterH, 14);
    ctx.clip();
    const img = images[index];
    if (img) {
      drawCover(ctx, img, posterX, posterY, posterW, posterH);
    } else {
      ctx.fillStyle = '#27272a';
      ctx.fillRect(posterX, posterY, posterW, posterH);
    }
    ctx.restore();

    const textX = posterX + posterW + 28;
    const textW = STORY_WIDTH - textX - 80;
    let title = movie.title;
    if (movie.ageRating) title += `  ·  ${movie.ageRating}`;
    ctx.fillStyle = '#fafafa';
    ctx.font = `700 ${cardH > 160 ? 34 : 26}px ${FONT}`;
    ctx.fillText(title, textX, posterY + 36, textW);

    const group = groupScreenings(movie.screenings)[0];
    const line = group ? formatTimesLine(group.times) : '';
    ctx.fillStyle = '#d4d4d8';
    ctx.font = `500 ${cardH > 160 ? 26 : 20}px ${FONT}`;
    ctx.fillText(line, textX, posterY + 78, textW);
  });

  ctx.fillStyle = '#71717a';
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText('gocinema.am', 64, 1892);
  ctx.fillStyle = '#e8c547';
  ctx.fillText('Instagram Stories · 9:16', 720, 1892);
}
