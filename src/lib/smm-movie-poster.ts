import type { InstagramStoryMovie } from '@/app/actions/instagram-story';
import {
  FEED_SIZE,
  FONT,
  STORY_HEIGHT,
  STORY_WIDTH,
  drawCover,
  fillBrandBackground,
  formatDuration,
  formatSessionLine,
  groupScreenings,
  loadImage,
  roundRect,
  wrapText,
} from '@/lib/smm-canvas';

export type PosterFormat = 'story' | 'feed';

export function posterSize(format: PosterFormat): {
  width: number;
  height: number;
} {
  if (format === 'feed') return { width: FEED_SIZE, height: FEED_SIZE };
  return { width: STORY_WIDTH, height: STORY_HEIGHT };
}

function metaLine(movie: InstagramStoryMovie): string {
  return [movie.genre, movie.ageRating, formatDuration(movie.duration)]
    .filter(Boolean)
    .join('  ·  ');
}

function drawPosterOrFallback(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (img) {
    drawCover(ctx, img, x, y, w, h);
    return;
  }
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#e8c547';
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText('GOCINEMA', x + 24, y + h / 2);
}

export async function renderMoviePoster(
  canvas: HTMLCanvasElement,
  movie: InstagramStoryMovie,
  format: PosterFormat
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const { width, height } = posterSize(format);
  canvas.width = width;
  canvas.height = height;

  const img = movie.image ? await loadImage(movie.image) : null;
  const lines = groupScreenings(movie.screenings).map(formatSessionLine);

  if (format === 'story') {
    fillBrandBackground(ctx, width, height);
    ctx.save();
    ctx.globalAlpha = 0.42;
    drawPosterOrFallback(ctx, img, 0, 0, width, height);
    ctx.restore();

    const topFade = ctx.createLinearGradient(0, 0, 0, 360);
    topFade.addColorStop(0, 'rgba(9,9,15,0.88)');
    topFade.addColorStop(1, 'rgba(9,9,15,0)');
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, width, 360);

    const bottomFade = ctx.createLinearGradient(0, 820, 0, height);
    bottomFade.addColorStop(0, 'rgba(9,9,15,0)');
    bottomFade.addColorStop(1, 'rgba(9,9,15,0.96)');
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, 820, width, height - 820);

    ctx.fillStyle = '#e8c547';
    ctx.font = `700 36px ${FONT}`;
    ctx.fillText('GOCINEMA', 64, 88);

    ctx.fillStyle = '#fafafa';
    ctx.font = `700 58px ${FONT}`;
    const titleLines = wrapText(ctx, movie.title, width - 128).slice(0, 3);
    titleLines.forEach((line, i) => {
      ctx.fillText(line, 64, 1180 + i * 68);
    });

    ctx.fillStyle = '#d4d4d8';
    ctx.font = `500 28px ${FONT}`;
    ctx.fillText(metaLine(movie), 64, 1180 + titleLines.length * 68 + 12);

    const cardY = 1180 + titleLines.length * 68 + 48;
    const cardH = Math.min(520, height - cardY - 90);
    ctx.fillStyle = 'rgba(22, 22, 31, 0.88)';
    roundRect(ctx, 48, cardY, width - 96, cardH, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 197, 71, 0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#e8c547';
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText('Սեանսներ', 80, cardY + 48);

    let fontSize = 26;
    while (fontSize > 16 && lines.length * (fontSize + 8) > cardH - 80) {
      fontSize -= 1;
    }
    ctx.fillStyle = '#e4e4e7';
    ctx.font = `500 ${fontSize}px ${FONT}`;
    const lineH = fontSize + 8;
    const maxLines = Math.max(1, Math.floor((cardH - 80) / lineH));
    const shown = lines.slice(0, maxLines);
    shown.forEach((line, i) => {
      ctx.fillText(line, 80, cardY + 88 + i * lineH, width - 176);
    });
    if (lines.length > shown.length) {
      ctx.fillStyle = '#e8c547';
      ctx.fillText(
        `+${lines.length - shown.length} օր ևս`,
        80,
        cardY + 88 + shown.length * lineH,
        width - 176
      );
    }

    ctx.fillStyle = '#a1a1aa';
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText('gocinema.am', 64, height - 36);
    return;
  }

  fillBrandBackground(ctx, width, height);
  ctx.save();
  roundRect(ctx, 0, 0, 470, height, 0);
  ctx.clip();
  drawPosterOrFallback(ctx, img, 0, 0, 470, height);
  ctx.restore();

  ctx.fillStyle = '#e8c547';
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText('GOCINEMA', 510, 64);

  ctx.fillStyle = '#fafafa';
  ctx.font = `700 42px ${FONT}`;
  const titleLines = wrapText(ctx, movie.title, 520).slice(0, 3);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, 510, 130 + i * 50);
  });

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(metaLine(movie), 510, 130 + titleLines.length * 50 + 8);

  const listTop = 130 + titleLines.length * 50 + 48;
  ctx.fillStyle = '#e8c547';
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText('Սեանսներ', 510, listTop);

  let fontSize = 22;
  const available = height - listTop - 80;
  while (fontSize > 14 && lines.length * (fontSize + 8) > available) {
    fontSize -= 1;
  }
  ctx.fillStyle = '#e4e4e7';
  ctx.font = `500 ${fontSize}px ${FONT}`;
  const lineH = fontSize + 8;
  const maxLines = Math.max(1, Math.floor(available / lineH));
  const shown = lines.slice(0, maxLines);
  shown.forEach((line, i) => {
    ctx.fillText(line, 510, listTop + 36 + i * lineH, 520);
  });
  if (lines.length > shown.length) {
    ctx.fillStyle = '#e8c547';
    ctx.fillText(
      `+${lines.length - shown.length} օր ևս`,
      510,
      listTop + 36 + shown.length * lineH,
      520
    );
  }

  ctx.fillStyle = '#71717a';
  ctx.font = `500 20px ${FONT}`;
  ctx.fillText('gocinema.am', 510, height - 32);
}
