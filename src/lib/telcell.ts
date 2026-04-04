import { createHash } from 'crypto';

export const TELCELL_INVOICE_URL = 'https://telcellmoney.am/invoices';

type MaybeString = string | number | undefined | null;

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

export function toBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

export function fromBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

function normalize(value: MaybeString): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

export function buildTelcellInvoiceSecurityCode(params: {
  secretKey: string;
  issuer: string;
  currency: string;
  price: string;
  product: string;
  issuerId: string;
  validDays: string;
  ssn?: string;
}): string {
  const payload =
    normalize(params.secretKey) +
    normalize(params.issuer) +
    normalize(params.currency) +
    normalize(params.price) +
    normalize(params.product) +
    normalize(params.issuerId) +
    normalize(params.validDays) +
    normalize(params.ssn);

  return md5(payload);
}

export function buildTelcellCallbackChecksum(params: {
  secretKey: string;
  invoice: string;
  issuerId: string;
  paymentId: string;
  currency: string;
  sum: string;
  time: string;
  status: string;
}): string {
  const payload =
    normalize(params.secretKey) +
    normalize(params.invoice) +
    normalize(params.issuerId) +
    normalize(params.paymentId) +
    normalize(params.currency) +
    normalize(params.sum) +
    normalize(params.time) +
    normalize(params.status);

  return md5(payload);
}
