export const META_ADS_SPENT_BY = 'Facebook Ads';
export const META_ADS_SUPPLIER_NAME = 'Meta Platforms Ireland Limited';
export const META_ADS_SUPPLIER_TIN = 'IE9692928F';

export interface MetaAdsPaymentRow {
  date: string;
  transactionId: string;
  amount: number;
  currency: string;
}

export interface ParsedMetaAdsCsv {
  accountId: string | null;
  paymentMethod: string | null;
  periodLabel: string | null;
  rows: MetaAdsPaymentRow[];
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function parseMetaDate(value: string): string | null {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!us) return null;
  const month = us[1].padStart(2, '0');
  const day = us[2].padStart(2, '0');
  return `${us[3]}-${month}-${day}`;
}

function parseAmount(value: string): number | null {
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function metaExternalId(transactionId: string): string {
  return `meta:${transactionId.trim()}`;
}

export function metaInvoiceNumber(transactionId: string): string {
  return `META-${transactionId.trim()}`.slice(0, 100);
}

export interface MetaAdsImportPreviewItem {
  transactionId: string;
  date: string;
  originalAmount: number;
  currency: string;
  fxRate: number;
  rateDate: string;
  amountAmd: number;
  duplicate: boolean;
}

export interface MetaAdsImportPreview {
  accountId: string | null;
  paymentMethod: string | null;
  periodLabel: string | null;
  newCount: number;
  duplicateCount: number;
  totalOriginal: number;
  totalAmd: number;
  currency: string | null;
  items: MetaAdsImportPreviewItem[];
}

export function parseMetaAdsInvoiceCsv(text: string): ParsedMetaAdsCsv {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd());

  let accountId: string | null = null;
  let paymentMethod: string | null = null;
  let periodLabel: string | null = null;
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const account = line.match(/^Account:\s*(.+)$/i);
    if (account) accountId = account[1].trim();
    const billing = line.match(/^Billing Report:\s*(.+)$/i);
    if (billing) periodLabel = billing[1].trim();
    const method = line.match(/^Payment Method:\s*(.+)$/i);
    if (method) paymentMethod = method[1].trim();
    const cols = splitCsvLine(line).map((c) => c.toLowerCase());
    if (
      cols.includes('date') &&
      cols.includes('transaction id') &&
      cols.includes('amount') &&
      cols.includes('currency')
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error(
      'Ֆայլը Meta Invoice Summary չէ։ Պետք է լինեն Date, Transaction ID, Amount, Currency սյուները։'
    );
  }

  const header = splitCsvLine(lines[headerIndex]).map((c) =>
    c.toLowerCase().replace(/\s+/g, ' ')
  );
  const dateIdx = header.indexOf('date');
  const idIdx = header.indexOf('transaction id');
  const amountIdx = header.indexOf('amount');
  const currencyIdx = header.indexOf('currency');

  const rows: MetaAdsPaymentRow[] = [];
  const seen = new Set<string>();

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitCsvLine(line);
    const dateRaw = cols[dateIdx] ?? '';
    const txId = (cols[idIdx] ?? '').trim();
    const amountRaw = cols[amountIdx] ?? '';
    const currency = (cols[currencyIdx] ?? '').trim().toUpperCase();

    if (/total amount billed/i.test(dateRaw) || /total amount billed/i.test(txId)) {
      break;
    }
    if (!txId || /^vat /i.test(dateRaw)) continue;

    const date = parseMetaDate(dateRaw);
    const amount = parseAmount(amountRaw);
    if (!date || !amount || !currency) continue;
    if (seen.has(txId)) continue;
    seen.add(txId);
    rows.push({ date, transactionId: txId, amount, currency });
  }

  if (rows.length === 0) {
    throw new Error('Ֆայլում հաստատված վճարումներ չգտնվեցին։');
  }

  return { accountId, paymentMethod, periodLabel, rows };
}
