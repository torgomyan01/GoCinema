import fs from 'fs';
import { PDFParse } from 'pdf-parse';

async function scan(file) {
  const parser = new PDFParse({ data: fs.readFileSync(file) });
  await parser.load();
  const text = await parser.getText();
  const t = typeof text === 'string' ? text : text.text || '';
  console.log('FILE', file, 'len', t.length);
  const patterns = [
    /59\.14[^\n]{0,120}/g,
    /5914[^\n]{0,120}/g,
    /կինո[^\n]{0,120}/gi,
    /կինեմատ[^\n]{0,120}/gi,
    /տոմս[^\n]{0,120}/gi,
    /\b05\d{3}\b/g,
    /\b92\d{2}\b/g,
    /\b01\d{2}\b/g,
  ];
  for (const re of patterns) {
    const m = [...t.matchAll(re)];
    if (m.length) {
      console.log('\nPATTERN', re, 'count', m.length);
      for (const x of m.slice(0, 8)) console.log(' ', x[0].replace(/\s+/g, ' ').slice(0, 160));
    }
  }
}

for (const f of ['media_2017_02_754.pdf', 'media_2017_02_752.pdf']) {
  await scan(f);
}
