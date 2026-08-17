const ONES = [
  '',
  'մեկ',
  'երկու',
  'երեք',
  'չորս',
  'հինգ',
  'վեց',
  'յոթ',
  'ութ',
  'ինը',
];

const TEENS = [
  'տասը',
  'տասնմեկ',
  'տասներկու',
  'տասներեք',
  'տասնչորս',
  'տասնհինգ',
  'տասնվեց',
  'տասնյոթ',
  'տասնութ',
  'տասնինը',
];

const TENS = [
  '',
  '',
  'քսան',
  'երեսուն',
  'քառասուն',
  'հիսուն',
  'վաթսուն',
  'յոթանասուն',
  'ութսուն',
  'իննսուն',
];

function underHundred(n: number): string {
  if (n < 10) return ONES[n] ?? '';
  if (n < 20) return TEENS[n - 10] ?? '';
  const ten = Math.floor(n / 10);
  const one = n % 10;
  if (one === 0) return TENS[ten] ?? '';
  return `${TENS[ten]}${ONES[one]}`;
}

/** Թիվը հայերեն բառերով, որ TTS-ը անգլերեն չկարդա։ */
export function numberToArmenian(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return 'զրո';

  const parts: string[] = [];
  const thousands = Math.floor(n / 1000);
  let rest = n % 1000;
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'հազար' : `${numberToArmenian(thousands)} հազար`);
  }
  const hundreds = Math.floor(rest / 100);
  rest %= 100;
  if (hundreds > 0) {
    parts.push(hundreds === 1 ? 'հարյուր' : `${ONES[hundreds]} հարյուր`);
  }
  if (rest > 0) parts.push(underHundred(rest));
  return parts.join(' ');
}

function dayFromPhrase(day: number): string {
  const word = numberToArmenian(day);
  if (word.endsWith('ը')) return `${word.slice(0, -1)}ից`;
  return `${word}ից`;
}

const SPEECH_ALIASES: Array<[RegExp, string]> = [
  [/\bgocinema\.am\b/gi, 'Գո Սինեմա'],
  [/\bgo\s*cinema\b/gi, 'Գո Սինեմա'],
  [/\bgocinema\b/gi, 'Գո Սինեմա'],
  [/\binstagram\b/gi, 'Ինստագրամ'],
  [/\bfacebook\b/gi, 'Ֆեյսբուք'],
  [/\byoutube\b/gi, 'Յութուբ'],
  [/\bqr\b/gi, 'քյու ար'],
];

/**
 * Տեքստը TTS-ի համար՝ հայերեն արտասանությամբ։
 * Սուբտիտրում մնում է բնօրինակը։
 */
export function rewriteForArmenianSpeech(text: string): string {
  let out = text;

  for (const [pattern, alias] of SPEECH_ALIASES) {
    out = out.replace(pattern, alias);
  }

  out = out.replace(/(\d+)\s*ից/g, (_, raw: string) => dayFromPhrase(Number(raw)));
  out = out.replace(/(\d+)\s*դրամ/g, (_, raw: string) => {
    return `${numberToArmenian(Number(raw))} դրամ`;
  });
  out = out.replace(/\d+/g, (raw) => numberToArmenian(Number(raw)));

  return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}
