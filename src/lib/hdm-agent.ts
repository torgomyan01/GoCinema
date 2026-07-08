/**
 * Browser client for the local GoCinema HDM agent (localhost HTTP bridge).
 * Runs on the box-office PC alongside the HDM device.
 */

export type HdmPaymentMethod = 'cash' | 'card';

export interface HdmReceiptItemInput {
  productCode: string;
  productName: string;
  price: number;
  qty?: number;
  adgCode?: string;
  dep?: number;
  unit?: string;
}

export interface HdmPrintReceiptInput {
  paymentMethod: HdmPaymentMethod;
  total: number;
  items: HdmReceiptItemInput[];
  eMarks?: string[];
  useExtPOS?: boolean;
}

export interface HdmFiscalReceipt {
  rseq: number;
  fiscal: string;
  crn: string;
  sn?: string;
  tin?: string;
  taxpayer?: string;
  address?: string;
  time?: number;
  lottery?: string;
  prize?: number;
  total: number;
  change: number;
  emarksCount?: string | number;
  verificationNumber?: string | number;
  qr?: string;
}

export interface HdmAgentStatus {
  operators: number;
  loggedIn: boolean;
}

export interface HdmOperatorsPayload {
  c?: Array<{ id: number; name: string; deps: number[] }>;
  d?: Array<{ id: number; name: string; type: number }>;
}

export interface HdmAgentResponse<T = unknown> {
  ok: boolean;
  error?: string;
  code?: number;
  fiscal?: T;
  details?: unknown;
  operators?: number | HdmOperatorsPayload;
  loggedIn?: boolean;
  result?: unknown;
  message?: string;
}

export function getHdmAgentUrl(): string {
  return (
    (typeof process !== 'undefined' &&
      process.env.NEXT_PUBLIC_HDM_AGENT_URL?.trim()) ||
    'http://127.0.0.1:3100'
  );
}

function getHdmAgentKey(): string {
  return (
    (typeof process !== 'undefined' &&
      process.env.NEXT_PUBLIC_HDM_AGENT_KEY?.trim()) ||
    ''
  );
}

const AGENT_URL = getHdmAgentUrl();
const AGENT_KEY = getHdmAgentKey();

export function isHdmAgentEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_HDM_AGENT_ENABLED;
  if (flag === '0' || flag === 'false') return false;
  return true;
}

async function agentFetch<T>(
  path: string,
  init?: RequestInit
): Promise<HdmAgentResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (AGENT_KEY) {
    headers.Authorization = `Bearer ${AGENT_KEY}`;
  }

  try {
    const res = await fetch(`${AGENT_URL}${path}`, {
      ...init,
      headers,
    });
    const data = (await res.json()) as HdmAgentResponse<T> & { fiscal?: T };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || `HDM agent error (${res.status})`,
        code: data.code,
        details: data.details,
      };
    }
    return data;
  } catch (err) {
    const message =
      err instanceof TypeError
        ? 'HDM agent-ը հասանելի չէ (ստուգեք, որ agent-ը աշխատում է դրամարկղի համակարգչում)'
        : err instanceof Error
          ? err.message
          : 'HDM agent connection failed';
    return { ok: false, error: message };
  }
}

/** GET /health — առանց API key */
export async function checkHdmAgentHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_URL}/health`, { method: 'GET' });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

/** GET /v1/diagnose */
export async function diagnoseHdmAgent(): Promise<
  HdmAgentResponse<{
    target: string;
    tcpConnected: boolean;
    protocolResponded: boolean;
    operators?: number;
    error?: string;
  }>
> {
  return agentFetch('/v1/diagnose', { method: 'GET' });
}

/** GET /v1/status */
export async function getHdmAgentStatus(): Promise<
  HdmAgentResponse<HdmAgentStatus>
> {
  return agentFetch<HdmAgentStatus>('/v1/status', { method: 'GET' });
}

/** POST /v1/login */
export async function hdmAgentLogin(): Promise<HdmAgentResponse> {
  return agentFetch('/v1/login', { method: 'POST', body: '{}' });
}

/** POST /v1/logout */
export async function hdmAgentLogout(): Promise<HdmAgentResponse> {
  return agentFetch('/v1/logout', { method: 'POST', body: '{}' });
}

/** GET /v1/operators */
export async function getHdmOperators(): Promise<
  HdmAgentResponse<HdmOperatorsPayload>
> {
  return agentFetch<HdmOperatorsPayload>('/v1/operators', { method: 'GET' });
}

/** POST /v1/print-receipt */
export async function printHdmReceipt(
  input: HdmPrintReceiptInput
): Promise<HdmAgentResponse<HdmFiscalReceipt>> {
  return agentFetch<HdmFiscalReceipt>('/v1/print-receipt', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** POST /v1/check-emark */
export async function checkHdmEmark(
  eMark: string
): Promise<HdmAgentResponse<unknown>> {
  return agentFetch('/v1/check-emark', {
    method: 'POST',
    body: JSON.stringify({ eMark }),
  });
}

/** Տոմսի վաճառք → HDM print-receipt input */
export function buildTicketSaleInput(input: {
  movieTitle: string;
  seatLabel: string;
  ticketPrice: number;
  paymentMethod: HdmPaymentMethod;
  total: number;
  products: Array<{ name: string; price: number; qty: number }>;
}): HdmPrintReceiptInput {
  const ticketName = `Տոմս · ${input.movieTitle} · ${input.seatLabel}`;
  const items: HdmReceiptItemInput[] = [
    {
      productCode: 'TICKET',
      productName: ticketName.slice(0, 50),
      price: input.ticketPrice,
      qty: 1,
      unit: 'տոմս',
    },
    ...input.products.map((p, idx) => ({
      productCode: `PROD-${idx + 1}`,
      productName: p.name,
      price: p.price,
      qty: p.qty,
      unit: 'հատ',
    })),
  ];

  return {
    paymentMethod: input.paymentMethod,
    total: input.total,
    items,
  };
}

/** Ապրանքների վաճառք → HDM print-receipt input */
export function buildProductSaleInput(input: {
  paymentMethod: HdmPaymentMethod;
  total: number;
  lines: Array<{
    name: string;
    price: number;
    qty: number;
    productCode?: string;
    eMark?: string | null;
  }>;
}): HdmPrintReceiptInput {
  const eMarks = input.lines
    .map((l) => l.eMark)
    .filter((code): code is string => Boolean(code?.trim()));

  const items: HdmReceiptItemInput[] = input.lines.map((line, idx) => ({
    productCode: line.productCode ?? `SKU-${idx + 1}`,
    productName: line.name,
    price: line.price,
    qty: line.qty,
    unit: 'հատ',
  }));

  return {
    paymentMethod: input.paymentMethod,
    total: input.total,
    items,
    eMarks: eMarks.length > 0 ? eMarks : undefined,
  };
}

/** Տոմսի վաճառք → HDM կտրոն */
export async function printHdmTicketSale(input: {
  movieTitle: string;
  seatLabel: string;
  ticketPrice: number;
  paymentMethod: HdmPaymentMethod;
  total: number;
  products: Array<{ name: string; price: number; qty: number }>;
}): Promise<HdmAgentResponse<HdmFiscalReceipt>> {
  return printHdmReceipt(buildTicketSaleInput(input));
}

/** Ապրանքների վաճառք → HDM կտրոն */
export async function printHdmProductSale(input: {
  paymentMethod: HdmPaymentMethod;
  total: number;
  lines: Array<{
    name: string;
    price: number;
    qty: number;
    productCode?: string;
    eMark?: string | null;
  }>;
}): Promise<HdmAgentResponse<HdmFiscalReceipt>> {
  return printHdmReceipt(buildProductSaleInput(input));
}

export interface HdmReturnReceiptInput {
  crn: string;
  returnTicketId: number;
  paymentMethod: HdmPaymentMethod;
  /** Մասնակի վերադարձի դեպքում՝ վերադարձվող գումարը (բացակայելիս՝ լրիվ վերադարձ) */
  amount?: number;
  eMarks?: string[];
  returnItemList?: Array<{ rpid: number; quantity: number }>;
}

/** POST /v1/return-receipt — վերադարձի կտրոն */
export async function printHdmReturn(
  input: HdmReturnReceiptInput
): Promise<HdmAgentResponse<HdmFiscalReceipt>> {
  return agentFetch<HdmFiscalReceipt>('/v1/return-receipt', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
