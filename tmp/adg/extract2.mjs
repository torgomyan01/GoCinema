import fs from 'fs';
import { PDFParse } from 'pdf-parse';

const parser = new PDFParse({ data: fs.readFileSync('media_2017_02_754.pdf') });
await parser.load();
const result = await parser.getText();
const t = result.text || '';
const lines = t.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/59\.14|5914|92\.05|9205|01\.04|0104|կինո|կինեմատ|ժամանց|տոմս/i.test(line) || /[A-Za-z\u0530-\u058F].{0,40}59\.14/.test(line)) {
    console.log('L' + (i+1) + ':', line.replace(/\s+/g, ' ').slice(0, 200));
    if (lines[i+1]) console.log('  next:', lines[i+1].replace(/\s+/g, ' ').slice(0, 200));
  }
}

// dump lines containing only code-like patterns at start
console.log('\n--- code lines 59.xx ---');
for (const line of lines) {
  if (/^59\.\d{2}(\.\d+)?\s/.test(line.trim())) console.log(line.trim().slice(0, 180));
}
