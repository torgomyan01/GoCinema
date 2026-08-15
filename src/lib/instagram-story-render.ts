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
  roundRect,
  wrapText,
} from '@/lib/smm-canvas';

export { STORY_HEIGHT, STORY_WIDTH, downloadCanvasPng } from '@/lib/smm-canvas';

function drawPoster(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 18);
  ctx.clip();
  ctx.fillStyle = '#0c0c12';
  ctx.fillRect(x, y, w, h);
  if (img) {
    drawContain(ctx, img, x, y, w, h);
  } else {
    ctx.fillStyle = '#e8c547';
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText('GO', x + w / 2 - 22, y + h / 2 + 10);
  }
  ctx.restore();

  roundRect(ctx, x, y, w, h, 18);
  ctx.strokeStyle = 'rgba(232, 197, 71, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

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
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText('GOCINEMA', 56, 78);
  ctx.fillStyle = '#fafafa';
  ctx.font = `700 58px ${FONT}`;
  ctx.fillText('Ժամանակացույց', 56, 148);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText('Այսօրվանից · օրեր, ժամեր, գին', 56, 192);
  ctx.fillStyle = '#e8c547';
  ctx.fillRect(56, 214, 140, 5);

  const top = 248;
  const bottom = 1836;
  const gap = 20;
  const count = Math.max(movies.length, 1);
  const cardH = (bottom - top - gap * (count - 1)) / count;
  const cardX = 40;
  const cardW = STORY_WIDTH - 80;
  const inset = 18;
  const posterRatio = 2 / 3;
  const posterH = cardH - inset * 2;
  const posterW = posterH * posterRatio;

  const images = await Promise.all(
    movies.map((movie) =>
      movie.image ? loadImage(movie.image) : Promise.resolve(null)
    )
  );

  movies.forEach((movie, index) => {
    const y = top + index * (cardH + gap);

    ctx.fillStyle = 'rgba(18, 18, 26, 0.94)';
    roundRect(ctx, cardX, y, cardW, cardH, 24);
    ctx.fill();
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(cardX, y + 24, 6, cardH - 48);

    const posterX = cardX + inset + 10;
    const posterY = y + inset;
    drawPoster(ctx, images[index], posterX, posterY, posterW, posterH);

    const textX = posterX + posterW + 28;
    const textW = cardX + cardW - textX - 28;
    const title = movie.ageRating
      ? `${movie.title}  ·  ${movie.ageRating}`
      : movie.title;

    ctx.fillStyle = '#fafafa';
    ctx.font = `700 ${posterH > 220 ? 36 : 30}px ${FONT}`;
    const titleLines = wrapText(ctx, title, textW).slice(0, 2);
    titleLines.forEach((line, i) => {
      ctx.fillText(line, textX, posterY + 40 + i * 42, textW);
    });

    const lines = groupScreenings(movie.screenings).map(formatSessionLine);
    const listTop = posterY + 40 + titleLines.length * 42 + 18;
    const available = posterY + posterH - listTop;
    let fontSize = 24;
    while (fontSize > 14 && lines.length * (fontSize + 8) > available) {
      fontSize -= 1;
    }
    ctx.fillStyle = '#d4d4d8';
    ctx.font = `500 ${fontSize}px ${FONT}`;
    const lineH = fontSize + 8;
    const maxLines = Math.max(1, Math.floor(available / lineH));
    const shown = lines.slice(0, maxLines);
    shown.forEach((line, i) => {
      ctx.fillStyle = '#e8c547';
      ctx.beginPath();
      ctx.arc(textX + 6, listTop + i * lineH - fontSize / 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d4d4d8';
      ctx.fillText(line, textX + 20, listTop + i * lineH, textW - 20);
    });
    if (lines.length > shown.length) {
      ctx.fillStyle = '#e8c547';
      ctx.font = `600 ${fontSize}px ${FONT}`;
      ctx.fillText(
        `+${lines.length - shown.length} օր ևս`,
        textX + 20,
        listTop + shown.length * lineH,
        textW - 20
      );
    }
  });

  ctx.fillStyle = '#71717a';
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText('gocinema.am', 56, 1896);
  ctx.fillStyle = '#e8c547';
  ctx.fillText('Instagram Stories · 9:16', 720, 1896);
}
