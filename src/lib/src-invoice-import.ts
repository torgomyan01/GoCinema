/**
 * ՊԵԿ/e-invoicing Excel export պարսեր։
 * - «Ստացված հարկային հաշիվներ» → ապրանքների գնում (purchase / products)
 * - «Ստացված հաշիվ վավերագրեր» → ծառայություն / արտադրող (producer / tickets)
 *
 * Նույն «Սերիա և համար»-ով տողերը համախմբվում են մեկ հաշվի (line-item exports)։
 */

export type SrcInvoiceFileKind = 'purchase' | 'producer' | 'unknown';

export interface ParsedSrcInvoice {
  kind: 'purchase' | 'producer';
  stream: 'products' | 'tickets';
  /** հոդ. 258 մաս 6՝ ապրանք վերավաճառքի / ծառայություն */
  costType: 'goods' | 'service';
  invoiceNumber: string;
  supplierTin: string | null;
  supplierName: string;
  status: string | null;
  documentDate: string; // YYYY-MM-DD
  amount: number;
  amountExVat: number | null;
  vatAmount: number | null;
  invoiceType: string | null;
  title: string;
  note: string;
}

export interface ParseSrcInvoicesResult {
  fileKind: SrcInvoiceFileKind;
  invoices: ParsedSrcInvoice[];
  skippedRows: number;
  warnings: string[];
}

function cellStr(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function normalizeHeader(value: unknown): string {
  return cellStr(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = cellStr(value).replace(/\s/g, '').replace(',', '.');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Excel serial / Date / string → YYYY-MM-DD (տեղական օր) */
export function parseSrcDate(value: unknown): string | null {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Excel/xlsx հաճախ տալիս է UTC գիշեր → օգտագործել Yerevan օր
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Yerevan',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    const ms = epoch + Math.round(value) * 86400000;
    return parseSrcDate(new Date(ms));
  }

  const s = cellStr(value);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parseSrcDate(parsed);
  }
  return null;
}

function detectFileKind(rows: unknown[][]): SrcInvoiceFileKind {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const title = cellStr(rows[i]?.[0]).toLowerCase();
    if (title.includes('հարկային հաշիվ')) return 'purchase';
    if (title.includes('հաշիվ վավերագիր') || title.includes('վավերագրեր')) {
      return 'producer';
    }
  }
  return 'unknown';
}

type ColMap = {
  invoiceNumber?: number;
  supplierTin?: number;
  supplierName?: number;
  status?: number;
  issueDate?: number;
  supplyDate?: number;
  totalAmount?: number;
  amountExVat?: number;
  vatAmount?: number;
  valueAmount?: number; // Արժեք (վավերագիր)
  invoiceType?: number;
};

function findHeaderRow(rows: unknown[][]): { index: number; map: ColMap } | null {
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i] ?? [];
    const map: ColMap = {};
    for (let c = 0; c < row.length; c++) {
      const h = normalizeHeader(row[c]);
      if (!h) continue;

      // Միայն առաջին համընկնումը — հետագա «ճշգրտված … դուրս գրման» սյուները չեն վերագրում
      if (map.invoiceNumber == null && h.includes('սերիա') && h.includes('համար')) {
        map.invoiceNumber = c;
      } else if (map.supplierTin == null && h.includes('հվհհ')) {
        map.supplierTin = c;
      } else if (
        map.supplierName == null &&
        h.includes('անվանում') &&
        h.includes('դուրս')
      ) {
        map.supplierName = c;
      } else if (map.status == null && h === 'կարգավիճակ') {
        map.status = c;
      } else if (
        map.issueDate == null &&
        h.includes('դուրս գրման') &&
        (h.includes('ա/թ') || h.includes('ամսաթիվ')) &&
        !h.includes('ճշգրտ')
      ) {
        map.issueDate = c;
      } else if (
        map.supplyDate == null &&
        (h.includes('մատակարարման') ||
          (h.includes('առաքման') &&
            (h.includes('ա/թ') || h.includes('ամսաթիվ') || h.includes('տեղափոխ'))))
      ) {
        map.supplyDate = c;
      } else if (map.totalAmount == null && h.includes('ընդհանուր գումար')) {
        map.totalAmount = c;
      } else if (
        map.amountExVat == null &&
        h.includes('շրջանառություն առանց')
      ) {
        map.amountExVat = c;
      } else if (map.valueAmount == null && h === 'արժեք') {
        map.valueAmount = c;
      } else if (
        map.vatAmount == null &&
        h.includes('աահ') &&
        h.includes('գումար')
      ) {
        map.vatAmount = c;
      } else if (map.invoiceType == null && h.includes('հաշվի տեսակ')) {
        map.invoiceType = c;
      }
    }

    if (map.invoiceNumber != null && (map.totalAmount != null || map.valueAmount != null)) {
      return { index: i, map };
    }
  }
  return null;
}

function pickAmount(
  kind: 'purchase' | 'producer',
  row: unknown[],
  map: ColMap
): { amount: number; amountExVat: number | null; vatAmount: number | null } {
  const amountExVat = map.amountExVat != null ? parseNumber(row[map.amountExVat]) : null;
  const vatAmount = map.vatAmount != null ? parseNumber(row[map.vatAmount]) : null;
  if (kind === 'producer') {
    const value = map.valueAmount != null ? parseNumber(row[map.valueAmount]) : null;
    const total = map.totalAmount != null ? parseNumber(row[map.totalAmount]) : null;
    const amount = value ?? total ?? 0;
    return { amount, amountExVat, vatAmount };
  }
  // Ապրանք՝ վճարվող ընդհանուր գումար (ԱԱՀ-ով)՝ շրջհարկ վճարողի ծախս
  const total = map.totalAmount != null ? parseNumber(row[map.totalAmount]) : null;
  const amount = total ?? amountExVat ?? 0;
  return { amount, amountExVat, vatAmount };
}

/**
 * @param rows — sheet_to_json({ header: 1 }) արդյունք
 * @param kindOverride — եթե auto չի ճանաչում
 */
export function parseSrcInvoiceRows(
  rows: unknown[][],
  kindOverride?: 'purchase' | 'producer' | 'auto'
): ParseSrcInvoicesResult {
  const warnings: string[] = [];
  let fileKind = detectFileKind(rows);
  if (kindOverride === 'purchase' || kindOverride === 'producer') {
    fileKind = kindOverride;
  }
  if (fileKind === 'unknown') {
    return {
      fileKind,
      invoices: [],
      skippedRows: 0,
      warnings: [
        'Ֆայլի տեսակը չճանաչվեց։ Սպասվում է «Ստացված հարկային հաշիվներ» կամ «Ստացված հաշիվ վավերագրեր».',
      ],
    };
  }

  const header = findHeaderRow(rows);
  if (!header) {
    return {
      fileKind,
      invoices: [],
      skippedRows: 0,
      warnings: ['Չգտնվեց սյունակների տողը (Սերիա և համար / գումար)։'],
    };
  }

  const byInvoice = new Map<string, ParsedSrcInvoice>();
  let skippedRows = 0;

  for (let i = header.index + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const invoiceNumber = cellStr(row[header.map.invoiceNumber!]);
    if (!invoiceNumber) {
      skippedRows += 1;
      continue;
    }

    const { amount, amountExVat, vatAmount } = pickAmount(fileKind, row, header.map);
    if (!(amount > 0)) {
      skippedRows += 1;
      continue;
    }

    const supplierName =
      header.map.supplierName != null
        ? cellStr(row[header.map.supplierName])
        : '';
    const supplierTin =
      header.map.supplierTin != null
        ? cellStr(row[header.map.supplierTin]) || null
        : null;
    const status =
      header.map.status != null ? cellStr(row[header.map.status]) || null : null;
    const invoiceType =
      header.map.invoiceType != null
        ? cellStr(row[header.map.invoiceType]) || null
        : null;

    const supplyDate =
      header.map.supplyDate != null
        ? parseSrcDate(row[header.map.supplyDate])
        : null;
    const issueDate =
      header.map.issueDate != null
        ? parseSrcDate(row[header.map.issueDate])
        : null;
    const documentDate = supplyDate || issueDate;
    if (!documentDate) {
      skippedRows += 1;
      warnings.push(`Բաց է թողնված ${invoiceNumber}՝ ամսաթիվ չկա`);
      continue;
    }

    // Մեկ հաշիվ = մեկ գրառում (կրկնվող տողերը line-item export են)
    if (byInvoice.has(invoiceNumber)) {
      skippedRows += 1;
      continue;
    }

    const kind = fileKind;
    const stream = kind === 'purchase' ? 'products' : 'tickets';
    const title =
      kind === 'purchase'
        ? `Ապրանքի գնում · ${supplierName || invoiceNumber}`
        : `Ֆիլմ արտադրող · ${supplierName || invoiceNumber}`;

    const noteParts = [
      status ? `Կարգավիճակ՝ ${status}` : null,
      invoiceType ? `Տեսակ՝ ${invoiceType}` : null,
      supplierTin ? `ՀՎՀՀ՝ ${supplierTin}` : null,
      amountExVat != null
        ? `Առանց ԱԱՀ՝ ${amountExVat.toLocaleString('hy-AM')} ֏`
        : null,
      vatAmount != null
        ? `ԱԱՀ՝ ${vatAmount.toLocaleString('hy-AM')} ֏`
        : null,
      'Ներմուծված ՊԵԿ Excel-ից',
    ].filter(Boolean);

    byInvoice.set(invoiceNumber, {
      kind,
      stream,
      costType: kind === 'purchase' ? 'goods' : 'service',
      invoiceNumber,
      supplierTin,
      supplierName: supplierName || 'Անհայտ մատակարար',
      status,
      documentDate,
      amount,
      amountExVat,
      vatAmount,
      invoiceType,
      title: title.slice(0, 255),
      note: noteParts.join(' · '),
    });
  }

  return {
    fileKind,
    invoices: Array.from(byInvoice.values()),
    skippedRows,
    warnings,
  };
}
