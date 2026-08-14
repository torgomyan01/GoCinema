/**
 * ՀՀ ԿԲ պաշտոնական փոխարժեքներ՝ SOAP Gate Web Service.
 * http://api.cba.am/exchangerates.asmx
 *
 * Հանգստյան օրերին ԿԲ-ն վերադարձնում է վերջին հրապարակված օրվա կուրսը
 * (CurrentDate), ոչ թե հարցված ամսաթիվը։
 */

const CBA_SOAP_URL = 'http://api.cba.am/exchangerates.asmx';
const CBA_NS = 'http://www.cba.am/';

export interface CbaRate {
  iso: string;
  /** 1 միավոր արտարժույթ = այսքան ֏ (Amount-ով նորմալացված) */
  amdPerUnit: number;
  /** ԿԲ-ի հրապարակման օրը (կարող է տարբերվել հարցվածից) */
  publishedDate: string;
}

function dateOnly(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match?.[1]?.trim() || null;
}

async function soapExchangeRatesByDateByIso(
  date: string,
  iso: string
): Promise<CbaRate> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ExchangeRatesByDateByISO xmlns="${CBA_NS}">
      <date>${date}T00:00:00</date>
      <ISO>${iso}</ISO>
    </ExchangeRatesByDateByISO>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(CBA_SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `${CBA_NS}ExchangeRatesByDateByISO`,
    },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`ԿԲ API սխալ (${res.status})`);
  }

  const xml = await res.text();
  const rateRaw = parseXmlTag(xml, 'Rate');
  const amountRaw = parseXmlTag(xml, 'Amount');
  const published = parseXmlTag(xml, 'CurrentDate');
  const rate = Number(String(rateRaw ?? '').replace(',', '.'));
  const amount = Number(String(amountRaw ?? '1').replace(',', '.')) || 1;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`ԿԲ-ն ${iso} կուրս չվերադարձրեց ${date}-ի համար`);
  }

  return {
    iso,
    amdPerUnit: rate / amount,
    publishedDate: published ? published.slice(0, 10) : date,
  };
}

const rateCache = new Map<string, Promise<CbaRate>>();

export async function getCbaAmdRate(
  iso: string,
  date: Date | string
): Promise<CbaRate> {
  const code = String(iso || '').trim().toUpperCase();
  const day = dateOnly(date);
  if (!code) throw new Error('Արժույթը բացակայում է');
  if (code === 'AMD') {
    return { iso: 'AMD', amdPerUnit: 1, publishedDate: day };
  }

  const key = `${day}:${code}`;
  const cached = rateCache.get(key);
  if (cached) return cached;

  const pending = soapExchangeRatesByDateByIso(day, code);
  rateCache.set(key, pending);
  try {
    return await pending;
  } catch (err) {
    rateCache.delete(key);
    throw err;
  }
}

export function convertToAmd(amount: number, amdPerUnit: number): number {
  return Math.round((Number(amount) || 0) * amdPerUnit);
}
