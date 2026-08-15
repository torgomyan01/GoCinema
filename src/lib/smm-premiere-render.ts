import type { SmmPremiere } from '@/app/actions/instagram-story';
import {
  FONT,
  STORY_HEIGHT,
  STORY_WIDTH,
  drawCover,
  fillBrandBackground,
  formatDuration,
  fullDateLabel,
  loadImage,
  premiereCountdown,
  roundRect,
  wrapText,
} from '@/lib/smm-canvas';

export async function renderPremiereStory(
  canvas: HTMLCanvasElement,
  premiere: SmmPremiere
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  fillBrandBackground(ctx, STORY_WIDTH, STORY_HEIGHT);

  const movie = premiere.movie;
  const img = movie.image ? await loadImage(movie.image) : null;
  const date = new Date(premiere.premiereDate);

  if (img) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawCover(ctx, img, 0, 0, STORY_WIDTH, STORY_HEIGHT);
    ctx.restore();
  }

  const topFade = ctx.createLinearGradient(0, 0, 0, 420);
  topFade.addColorStop(0, 'rgba(9,9,15,0.9)');
  topFade.addColorStop(1, 'rgba(9,9,15,0)');
  ctx.fillStyle = topFade;
  ctx.fillRect(0, 0, STORY_WIDTH, 420);

  const bottomFade = ctx.createLinearGradient(0, 900, 0, STORY_HEIGHT);
  bottomFade.addColorStop(0, 'rgba(9,9,15,0)');
  bottomFade.addColorStop(1, 'rgba(9,9,15,0.97)');
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, 900, STORY_WIDTH, STORY_HEIGHT - 900);

  ctx.fillStyle = '#e8c547';
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText('GOCINEMA', 64, 88);

  ctx.fillStyle = 'rgba(232, 197, 71, 0.18)';
  roundRect(ctx, 64, 130, 280, 56, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232, 197, 71, 0.55)';
  ctx.lineWidth = 2;
  roundRect(ctx, 64, 130, 280, 56, 28);
  ctx.stroke();
  ctx.fillStyle = '#e8c547';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText('ՊՐԵՄԻԵՐԱ', 92, 168);

  const countdown = premiereCountdown(date);
  ctx.fillStyle = '#e8c547';
  ctx.font = `700 72px ${FONT}`;
  ctx.fillText(countdown, 64, 1280);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText(fullDateLabel(date), 64, 1336);

  ctx.fillStyle = '#fafafa';
  ctx.font = `700 58px ${FONT}`;
  const titleLines = wrapText(ctx, movie.title, STORY_WIDTH - 128).slice(0, 3);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, 64, 1420 + i * 68);
  });

  const meta = [movie.genre, movie.ageRating, formatDuration(movie.duration)]
    .filter(Boolean)
    .join('  ·  ');
  ctx.fillStyle = '#d4d4d8';
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(meta, 64, 1420 + titleLines.length * 68 + 8);

  const blurb = premiere.description || movie.description;
  if (blurb) {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = `400 24px ${FONT}`;
    wrapText(ctx, blurb, STORY_WIDTH - 128)
      .slice(0, 2)
      .forEach((line, i) => {
        ctx.fillText(line, 64, 1420 + titleLines.length * 68 + 56 + i * 32);
      });
  }

  ctx.fillStyle = '#71717a';
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText('gocinema.am', 64, 1892);
  ctx.fillStyle = '#e8c547';
  ctx.fillText('Instagram Stories · 9:16', 720, 1892);
}
