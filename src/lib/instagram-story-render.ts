import type { InstagramStoryMovie } from '@/app/actions/instagram-story';
import {
  FONT,
  STORY_HEIGHT,
  STORY_WIDTH,
  drawContain,
  fillBrandBackground,
  formatSessionLine,
  groupScreenings,
  loadImage,
  posterFitSize,
  roundRect,
} from '@/lib/smm-canvas';

export { STORY_HEIGHT, STORY_WIDTH, downloadCanvasPng } from '@/lib/smm-canvas';

export async function renderInstagramStory(
  canvas: HTMLCanvasElement,
  movies: InstagramStoryMovie[]
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  fillBrandBackground(ctx, STORY_WIDTH, STORY_HEIGHT);

  ctx.fillStyle = '#e8c547';
  ctx.font = `700 42px ${FONT}`;
  ctx.fillText('GOCINEMA', 64, 92);
  ctx.fillStyle = '#f4f4f5';
  ctx.font = `600 54px ${FONT}`;
  ctx.fillText('Ժամանակացույց', 64, 158);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText('Այսօրվանից · օրեր, ժամեր, գին', 64, 204);

  const top = 240;
  const bottom = 1840;
  const gap = 18;
  const count = Math.max(movies.length, 1);
  const cardH = (bottom - top - gap * (count - 1)) / count;
  const maxPosterW = 280;
  const maxPosterH = Math.max(120, cardH - 36);

  const images = await Promise.all(
    movies.map((movie) =>
      movie.image ? loadImage(movie.image) : Promise.resolve(null)
    )
  );

  movies.forEach((movie, index) => {
    const y = top + index * (cardH + gap);
    ctx.fillStyle = 'rgba(22, 22, 31, 0.92)';
    roundRect(ctx, 48, y, STORY_WIDTH - 96, cardH, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 197, 71, 0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const img = images[index];
    const { w: posterW, h: posterH } = posterFitSize(
      img,
      maxPosterW,
      maxPosterH
    );
    const posterX = 72;
    const posterY = y + (cardH - posterH) / 2;
    ctx.save();
    roundRect(ctx, posterX, posterY, posterW, posterH, 16);
    ctx.clip();
    ctx.fillStyle = '#18181b';
    ctx.fillRect(posterX, posterY, posterW, posterH);
    if (img) {
      drawContain(ctx, img, posterX, posterY, posterW, posterH);
    } else {
      ctx.fillStyle = '#71717a';
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText('GO', posterX + posterW / 2 - 16, posterY + posterH / 2);
    }
    ctx.restore();

    const textX = posterX + posterW + 28;
    const textW = STORY_WIDTH - textX - 80;
    let title = movie.title;
    if (movie.ageRating) title += `  ·  ${movie.ageRating}`;
    ctx.fillStyle = '#fafafa';
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(title, textX, posterY + 36, textW);

    const lines = groupScreenings(movie.screenings).map(formatSessionLine);
    const available = cardH - 70;
    let fontSize = 24;
    while (fontSize > 12 && lines.length * (fontSize + 6) > available) {
      fontSize -= 1;
    }
    ctx.fillStyle = '#d4d4d8';
    ctx.font = `500 ${fontSize}px ${FONT}`;
    const lineH = fontSize + 6;
    const maxLines = Math.max(1, Math.floor(available / lineH));
    const shown = lines.slice(0, maxLines);
    shown.forEach((line, i) => {
      ctx.fillText(line, textX, posterY + 52 + (i + 1) * lineH, textW);
    });
    if (lines.length > shown.length) {
      ctx.fillStyle = '#e8c547';
      ctx.fillText(
        `+${lines.length - shown.length} օր ևս`,
        textX,
        posterY + 52 + (shown.length + 1) * lineH,
        textW
      );
    }
  });

  ctx.fillStyle = '#71717a';
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText('gocinema.am', 64, 1892);
  ctx.fillStyle = '#e8c547';
  ctx.fillText('Instagram Stories · 9:16', 720, 1892);
}
