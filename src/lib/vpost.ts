import { createHash } from 'crypto';

type VPostEnvelope<T> = {
  data?: T;
  message?: string;
  status?: boolean;
};

type VPostOrderData = {
  itfOrderId?: string;
  partnerOrderId?: string;
  customerID?: string;
  redirectURL?: string;
  needToRedirect?: boolean;
};

type VPostCustomerData = {
  clientID?: string;
};

type VPostTransactionListItem = {
  createdAt?: string;
  order?: {
    id?: number;
    status?: number;
  };
  response?: {
    ResponseCode?: string;
    PaymentState?: string;
    OrderStatus?: string;
  };
};

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

function sanitizeEnvValue(value?: string) {
  if (!value) return value;
  const trimmed = value.trim();
  return trimmed.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
}

function isVPostDebugEnabled() {
  return (process.env.PAYMENT_DEBUG || '').toLowerCase() === 'true';
}

function maskValue(value?: string, visibleStart = 4, visibleEnd = 4) {
  if (!value) return '';
  if (value.length <= visibleStart + visibleEnd) return '*'.repeat(value.length);
  return `${value.slice(0, visibleStart)}***${value.slice(-visibleEnd)}`;
}

function sanitizePayloadForLog(payload: Record<string, unknown>) {
  const clone: Record<string, unknown> = { ...payload };
  if (typeof clone.phoneNumber === 'string') {
    clone.phoneNumber = maskValue(clone.phoneNumber, 4, 2);
  }
  if (typeof clone.email === 'string') {
    clone.email = maskValue(clone.email, 2, 6);
  }
  if (typeof clone.firstName === 'string') {
    clone.firstName = maskValue(clone.firstName, 1, 1);
  }
  if (typeof clone.lastName === 'string') {
    clone.lastName = maskValue(clone.lastName, 1, 1);
  }
  return clone;
}

function getVPostConfig() {
  const publicKey =
    sanitizeEnvValue(process.env.PAYMENT_PUBLIC_KEY) ||
    sanitizeEnvValue(process.env.PAYMENT__PUBLIC_KEY);
  const secretKey = sanitizeEnvValue(process.env.PAYMENT_SECRET_KEY);
  const mode = (process.env.PAYMENT_MODE || 'live').toLowerCase();
  const baseUrl =
    process.env.PAYMENT_BASE_URL ||
    (mode === 'test'
      ? 'http://testpos.itfllc.am/api/bipos/test'
      : 'https://paymentsystem.itfllc.am/payments/live');

  return {
    publicKey,
    secretKey,
    baseUrl: sanitizeEnvValue(baseUrl)?.replace(/\/$/, ''),
  };
}

function signatureInvalid(message?: string) {
  if (!message) return false;
  return /signature.+invalid/i.test(message);
}

async function vpostRequest<T>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<VPostEnvelope<T>> {
  const config = getVPostConfig();
  if (!config.publicKey || !config.secretKey || !config.baseUrl) {
    throw new Error('VPost credentials are missing');
  }

  const url = `${config.baseUrl}${endpoint}`;

  // Keep both concatenation strategies as fallback for providers
  // with inconsistent signature documentation/implementations.
  const signatures = Array.from(
    new Set([
      md5(config.secretKey + config.publicKey),
      md5(config.publicKey + config.secretKey),
    ])
  );

  const headerVariants = signatures.map((signature) => ({
    'Content-Type': 'application/json',
    'public-key': config.publicKey as string,
    signature,
  }));

  let lastResponse: VPostEnvelope<T> = {
    status: false,
    message: 'vPost request failed',
  };

  for (let attempt = 0; attempt < headerVariants.length; attempt += 1) {
    const headers = headerVariants[attempt];
    if (isVPostDebugEnabled()) {
      console.info('[vPost] Request', {
        endpoint,
        attempt: attempt + 1,
        mode: (process.env.PAYMENT_MODE || 'live').toLowerCase(),
        baseUrl: config.baseUrl,
        publicKeyPreview: maskValue(config.publicKey, 6, 6),
        signaturePreview: maskValue(headers.signature, 6, 6),
        payload: sanitizePayloadForLog(payload),
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const responseText = await response.text();
    let json: VPostEnvelope<T>;
    try {
      json = JSON.parse(responseText) as VPostEnvelope<T>;
    } catch {
      json = {
        status: false,
        message: `Non-JSON response: ${responseText.slice(0, 300)}`,
      };
    }

    if (isVPostDebugEnabled()) {
      console.info('[vPost] Response', {
        endpoint,
        attempt: attempt + 1,
        httpStatus: response.status,
        ok: response.ok,
        status: json.status,
        message: json.message,
      });
    }

    lastResponse = json;

    if (json.status) return json;
    if (!signatureInvalid(json.message)) return json;
  }

  return lastResponse;
}

export function hasVPostConfig() {
  const config = getVPostConfig();
  return Boolean(config.publicKey && config.secretKey);
}

export async function createVPostOrder(payload: {
  customerID: string;
  amount: number;
  orderID: number;
  backURL: string;
  description?: string;
  lang?: 'hy' | 'en' | 'ru';
}) {
  const normalizedAmount = Number(payload.amount.toFixed(2));
  return vpostRequest<VPostOrderData>('/order/new', {
    customerID: String(payload.customerID),
    // vPost often validates this as 0/1 in practice
    attachCard: 0,
    amount: normalizedAmount,
    orderID: Number(payload.orderID),
    backURL: payload.backURL,
    description: payload.description || `GoCinema Order #${payload.orderID}`,
    lang: payload.lang || 'hy',
    osType: 3, // Web
  });
}

export async function createVPostCustomer(payload: {
  customerID: string;
  firstName: string;
  lastName?: string;
  phoneNumber: string;
  email?: string;
}) {
  const safeFirstName = payload.firstName.trim() || 'GoCinema';
  const safeLastName = payload.lastName?.trim();
  const phone = String(payload.phoneNumber).replace(/\s+/g, '');

  const candidatePhones = Array.from(
    new Set([
      phone,
      phone.startsWith('+') ? phone.slice(1) : `+${phone}`,
      phone.startsWith('+374') ? `0${phone.slice(4)}` : phone,
    ])
  ).filter(Boolean);

  const candidatePayloads: Array<Record<string, unknown>> = candidatePhones.map(
    (phoneCandidate) => ({
      customerID: String(payload.customerID),
      firstName: safeFirstName,
      ...(safeLastName ? { lastName: safeLastName } : {}),
      phoneNumber: phoneCandidate,
      ...(payload.email ? { email: payload.email } : {}),
    })
  );

  // Final strict fallback with minimal ASCII-safe fields.
  candidatePayloads.push({
    customerID: String(payload.customerID),
    firstName: 'GoCinema',
    phoneNumber: candidatePhones[0] || '+37400000000',
  });

  let lastResponse: VPostEnvelope<VPostCustomerData> = {
    status: false,
    message: 'Invalid data',
  };

  for (const body of candidatePayloads) {
    if (isVPostDebugEnabled()) {
      console.info('[vPost] customer/new candidate', {
        payload: sanitizePayloadForLog(body),
      });
    }
    const response = await vpostRequest<VPostCustomerData>('/customer/new', body);
    if (response.status) return response;
    lastResponse = response;
  }

  return lastResponse;
}

export async function getVPostTransactionsByOrder(orderID: number) {
  return vpostRequest<{ list?: VPostTransactionListItem[] }>(
    '/transactions/list',
    {
      orderID,
    }
  );
}

export function isVPostPaymentApproved(
  tx?: VPostTransactionListItem
): boolean {
  if (!tx) return false;

  const responseCode = tx.response?.ResponseCode;
  const paymentState = tx.response?.PaymentState;
  const orderStatus = tx.response?.OrderStatus;
  const internalStatus = tx.order?.status;

  return (
    responseCode === '00' ||
    paymentState === 'payment_approved' ||
    paymentState === 'payment_deposited' ||
    orderStatus === '1' ||
    orderStatus === '2' ||
    internalStatus === 1 ||
    internalStatus === 2
  );
}

export function isVPostPaymentDeclined(tx?: VPostTransactionListItem): boolean {
  if (!tx) return false;
  const paymentState = tx.response?.PaymentState;
  const internalStatus = tx.order?.status;
  const orderStatus = tx.response?.OrderStatus;

  return (
    paymentState === 'payment_declined' ||
    paymentState === 'payment_void' ||
    orderStatus === '3' ||
    orderStatus === '6' ||
    internalStatus === 3 ||
    internalStatus === 6
  );
}
