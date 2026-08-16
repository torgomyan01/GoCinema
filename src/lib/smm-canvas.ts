import { formatDateKey, formatTimeHy } from '@/lib/format';

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
export const FEED_SIZE = 1080;

export const WEEKDAY_SHORT = ['Կիր', 'Երկ', 'Երք', 'Չրք', 'Հնգ', 'Ուրբ', 'Շբթ'];
export const WEEKDAY_FULL = [
  'կիրակի',
  'երկուշաբթի',
  'երեքշաբթի',
  'չորեքշաբթի',
  'հինգշաբթի',
  'ուրբաթ',
  'շաբաթ',
];
export const MONTH_SHORT = [
  'հնվ',
  'փտր',
  'մրտ',
  'ապր',
  'մայ',
  'հնս',
  'հլս',
  'օգս',
  'սեպ',
  'հկտ',
  'նոյ',
  'դեկ',
];
export const MONTH_FULL = [
  'հունվարի',
  'փետրվարի',
  'մարտի',
  'ապրիլի',
  'մայիսի',
  'հունիսի',
  'հուլիսի',
  'օգոստոսի',
  'սեպտեմբերի',
  'հոկտեմբերի',
  'նոյեմբերի',
  'դեկտեմբերի',
];

export const FONT =
  '"Segoe UI", "Noto Sans Armenian", Arial, sans-serif';

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatAmd(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} ժ ${m} ր`;
  if (h) return `${h} ժ`;
  return `${m} ր`;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayLabel(date: Date): string {
  return `${WEEKDAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

export function fullDateLabel(date: Date): string {
  return `${date.getDate()} ${MONTH_FULL[date.getMonth()]}`;
}

export function moviePublicPath(slug: string | null, id: number): string {
  return `/movies/${slug || id}`;
}

export function moviePublicUrl(slug: string | null, id: number): string {
  return `https://gocinema.am${moviePublicPath(slug, id)}`;
}

export type SessionTime = { time: string; price: number };

export type SessionGroup = {
  key: string;
  label: string;
  times: SessionTime[];
};

export function groupScreenings(
  screenings: Array<{ startTime: string; price: number }>
): SessionGroup[] {
  const groups = new Map<string, SessionGroup>();

  for (const row of screenings) {
    const date = new Date(row.startTime);
    const key = formatDateKey(date);
    const time = formatTimeHy(date);
    if (!key || !time) continue;
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(date), times: [] };
      groups.set(key, group);
    }
    if (!group.times.some((t) => t.time === time && t.price === row.price)) {
      group.times.push({ time, price: row.price });
    }
  }

  return Array.from(groups.values());
}

export function formatSessionLine(group: SessionGroup): string {
  const prices = Array.from(new Set(group.times.map((t) => t.price)));
  const times = group.times.map((t) => t.time).join(', ');
  if (prices.length === 1) {
    return `${group.label}  ·  ${times}  ·  ${formatAmd(prices[0])}`;
  }
  const mixed = group.times
    .map((t) => `${t.time} ${formatAmd(t.price)}`)
    .join('  ·  ');
  return `${group.label}  ·  ${mixed}`;
}

export function formatTimesLine(times: SessionTime[]): string {
  const prices = Array.from(new Set(times.map((t) => t.price)));
  const clock = times.map((t) => t.time).join(', ');
  if (prices.length === 1) return `${clock}  ·  ${formatAmd(prices[0])}`;
  return times.map((t) => `${t.time} ${formatAmd(t.price)}`).join('  ·  ');
}

export function premiereCountdown(premiereDate: Date, now = new Date()): string {
  const start = startOfDay(now);
  const day = startOfDay(premiereDate);
  const days = Math.round((day.getTime() - start.getTime()) / 86400000);
  if (days < 0) return 'Արդեն';
  if (days === 0) return 'Այսօր';
  if (days === 1) return 'Վաղը';

  const weekStart = (d: Date) => {
    const x = startOfDay(d);
    const wd = x.getDay();
    x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd));
    return x;
  };
  if (weekStart(day).getTime() === weekStart(start).getTime()) {
    return `Այս ${WEEKDAY_FULL[premiereDate.getDay()]}`;
  }
  if (days <= 7) return `Հաջորդ ${WEEKDAY_FULL[premiereDate.getDay()]}`;
  return fullDateLabel(premiereDate);
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

export function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

export function posterFitSize(
  img: HTMLImageElement | null,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  if (!img || !img.width || !img.height) {
    return { w: Math.min(168, maxW), h: Math.min(240, maxH) };
  }
  const ratio = img.width / img.height;
  let h = maxH;
  let w = h * ratio;
  if (w > maxW) {
    w = maxW;
    h = w / ratio;
  }
  return { w, h };
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${current} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) current = test;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

export function fillBrandBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#12081c');
  bg.addColorStop(0.45, '#09090f');
  bg.addColorStop(1, '#1a0f08');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(232, 197, 71, 0.12)';
  ctx.beginPath();
  ctx.arc(width - 100, 80, 220, 0, Math.PI * 2);
  ctx.fill();
}

export function smmPngName(kind: string): string {
  const stamp = new Date();
  return `gocinema-${kind}-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}.png`;
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
