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

type VPostConfirmPaymentData = {
  responseCode?: string;
  itfOrderId?: string;
  partnerOrderId?: string;
  customerID?: string;
  redirectURL?: string;
};

type VPostCancelPaymentData = {
  itfOrderId?: string;
  partnerOrderId?: string;
};

type VPostCustomerData = {
  clientID?: string;
};

type VPostTransactionListItem = {
  createdAt?: string;
  humandate?: string;
  partner?: string;
  amount?: number;
  fee?: number;
  totalAmount?: number;
  description?: string;
  order?: {
    id?: number;
    status?: number;
    partnerOrderId?: number;
    amount?: number;
    fee?: number;
    totalAmount?: number;
    customerId?: number;
    date?: string;
    description?: string;
    cardID?: number;
  };
  /** ITF docs — PascalCase */
  response?: Record<string, unknown>;
};

export type { VPostTransactionListItem };

export type VPostPaginate = {
  total?: number;
  per_page?: number;
  current_page?: number;
  last_page?: number;
};

function isVpostServerLogEnabled() {
  const v = (process.env.PAYMENT_LOG || '').toLowerCase();
  if (v === 'true' || v === '1') return true;
  if ((process.env.PAYMENT_DEBUG || '').toLowerCase() === 'true') return true;
  return process.env.NODE_ENV === 'development';
}

function vpostServerLog(event: string, payload: Record<string, unknown>) {
  if (!isVpostServerLogEnabled()) return;
  try {
    console.info(`[vPost] ${event}`, JSON.stringify(payload));
  } catch {
    console.info(`[vPost] ${event}`, payload);
  }
}

/** API-ն երբեմն տալիս է camelCase կամ այլ nesting */
function coerceOrder(raw: unknown): VPostTransactionListItem['order'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const idNum = parseInt(String(o.id ?? ''), 10);
  const partnerRaw =
    o.partnerOrderId ??
    o.partner_order_id ??
    o.partnerorderid ??
    o.orderId ??
    o.orderID ??
    o.OrderId;
  const partnerNum = partnerRaw != null ? parseInt(String(partnerRaw), 10) : NaN;
  const amountRaw = o.amount ?? o.Amount;
  const feeRaw = o.fee ?? o.Fee;
  const totalRaw = o.totalAmount ?? o.TotalAmount;
  const customerRaw = o.customerId ?? o.customerID ?? o.CustomerId;
  const statusRaw = o.status ?? o.Status;
  const dateRaw = o.date ?? o.Date;
  const descRaw = o.description ?? o.Description;

  return {
    id: Number.isFinite(idNum) && idNum > 0 ? idNum : undefined,
    partnerOrderId:
      Number.isFinite(partnerNum) && partnerNum > 0 ? partnerNum : undefined,
    amount:
      typeof amountRaw === 'number'
        ? amountRaw
        : amountRaw != null
          ? parseFloat(String(amountRaw))
          : undefined,
    fee:
      typeof feeRaw === 'number'
        ? feeRaw
        : feeRaw != null
          ? parseFloat(String(feeRaw))
          : undefined,
    totalAmount:
      typeof totalRaw === 'number'
        ? totalRaw
        : totalRaw != null
          ? parseFloat(String(totalRaw))
          : undefined,
    customerId:
      customerRaw != null ? parseInt(String(customerRaw), 10) : undefined,
    status:
      typeof statusRaw === 'number'
        ? statusRaw
        : statusRaw != null
          ? parseInt(String(statusRaw), 10)
          : undefined,
    date: typeof dateRaw === 'string' ? dateRaw : undefined,
    description: typeof descRaw === 'string' ? descRaw : undefined,
    cardID:
      o.cardID != null
        ? parseInt(String(o.cardID), 10)
        : o.cardId != null
          ? parseInt(String(o.cardId), 10)
          : undefined,
  };
}

function coerceTxItem(raw: unknown): VPostTransactionListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const order = coerceOrder(r.order);
  let response = r.response as Record<string, unknown> | undefined;
  if (!response && typeof r.ResponseCode !== 'undefined') {
    response = r as Record<string, unknown>;
  }
  return {
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : undefined,
    humandate: typeof r.humandate === 'string' ? r.humandate : undefined,
    partner: typeof r.partner === 'string' ? r.partner : undefined,
    amount: typeof r.amount === 'number' ? r.amount : order?.amount,
    fee: typeof r.fee === 'number' ? r.fee : order?.fee,
    totalAmount:
      typeof r.totalAmount === 'number' ? r.totalAmount : order?.totalAmount,
    description:
      typeof r.description === 'string'
        ? r.description
        : order?.description,
    order,
    response,
  };
}

function extractTransactionsList(data: unknown): VPostTransactionListItem[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data
      .map(coerceTxItem)
      .filter((x): x is VPostTransactionListItem => x != null);
  }
  if (typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  const rawList =
    d.list ??
    d.transactions ??
    d.items ??
    (d.data as Record<string, unknown> | undefined)?.list;
  if (Array.isArray(rawList)) {
    return rawList
      .map(coerceTxItem)
      .filter((x): x is VPostTransactionListItem => x != null);
  }
  // Մեկ transaction օբյեկտ
  const single = coerceTxItem(data);
  return single ? [single] : [];
}

function parseTxDate(tx: VPostTransactionListItem): number {
  const s = tx.createdAt || tx.humandate;
  if (!s) return 0;
  const t = Date.parse(s.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
  return Number.isFinite(t) ? t : 0;
}

function readResponseField(
  response: Record<string, unknown> | undefined,
  keys: string[]
): unknown {
  if (!response) return undefined;
  for (const k of keys) {
    const v = response[k];
    if (v != null && v !== '') return v;
  }
  return undefined;
}

/** Ամենանորից հին — ցուցակի կարգը API-ում երաշխավորված չէ */
export function sortTransactionsNewestFirst(
  list: VPostTransactionListItem[]
): VPostTransactionListItem[] {
  return [...list].sort((a, b) => parseTxDate(b) - parseTxDate(a));
}

export function summarizeTransactionForLog(tx: VPostTransactionListItem) {
  const resp = tx.response;
  const responseCode = readResponseField(resp, ['ResponseCode', 'responseCode']);
  const paymentState = readResponseField(resp, ['PaymentState', 'paymentState']);
  const orderStatus = readResponseField(resp, ['OrderStatus', 'orderStatus']);
  const cardRaw = String(
    readResponseField(resp, ['CardNumber', 'cardNumber']) ?? ''
  );
  const cardMasked =
    cardRaw.length > 6
      ? `${cardRaw.slice(0, 4)}***${cardRaw.slice(-4)}`
      : cardRaw
        ? '***'
        : '';
  return {
    createdAt: tx.createdAt,
    orderId: tx.order?.id,
    orderInternalStatus: tx.order?.status,
    ResponseCode: responseCode != null ? String(responseCode) : undefined,
    PaymentState: paymentState != null ? String(paymentState) : undefined,
    OrderStatus: orderStatus != null ? String(orderStatus) : undefined,
    partnerOrderId: tx.order?.partnerOrderId,
    CardNumber: cardMasked || undefined,
  };
}

/** `/transactions/list` պատասխանի `data` — նորմալացված ցուցակ */
export function getNormalizedTransactionsFromVPostEnvelope(
  envelope: VPostEnvelope<unknown>
): VPostTransactionListItem[] {
  return sortTransactionsNewestFirst(extractTransactionsList(envelope.data));
}

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
  const publicKey = sanitizeEnvValue(process.env.PAYMENT_PUBLIC_KEY);
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

async function vpostRequest<T>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<VPostEnvelope<T>> {
  const config = getVPostConfig();
  if (!config.publicKey || !config.secretKey || !config.baseUrl) {
    throw new Error('VPost credentials are missing');
  }

  const url = `${config.baseUrl}${endpoint}`;

  // Ստորագրությունը ITF/vPost փաստաթղթի համաձայն՝ md5(ClientPrivateKey + ClientPublicKey)։
  const signature = md5(config.secretKey + config.publicKey);
  const headers = {
    'Content-Type': 'application/json',
    'public-key': config.publicKey,
    signature,
  };

  if (isVpostServerLogEnabled()) {
    vpostServerLog('request', {
      endpoint,
      url,
      payload: sanitizePayloadForLog({ ...payload }),
    });
  }
  if (isVPostDebugEnabled()) {
    console.info('[vPost] Request', {
      endpoint,
      mode: (process.env.PAYMENT_MODE || 'live').toLowerCase(),
      baseUrl: config.baseUrl,
      publicKeyPreview: maskValue(config.publicKey, 6, 6),
      signaturePreview: maskValue(signature, 6, 6),
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

  if (isVpostServerLogEnabled() && json.message?.startsWith('Non-JSON')) {
    vpostServerLog('raw_body', {
      endpoint,
      httpStatus: response.status,
      snippet: responseText.slice(0, 800),
    });
  }

  if (isVPostDebugEnabled()) {
    console.info('[vPost] Response', {
      endpoint,
      httpStatus: response.status,
      ok: response.ok,
      status: json.status,
      message: json.message,
    });
  }

  if (isVpostServerLogEnabled()) {
    const data = json.data as Record<string, unknown> | undefined;
    const logPayload: Record<string, unknown> = {
      endpoint,
      httpStatus: response.status,
      envelopeStatus: json.status,
      message: json.message,
    };
    if (endpoint === '/transactions/list' && data) {
      const list = extractTransactionsList(data);
      logPayload.listLength = list.length;
      logPayload.items = list.map(summarizeTransactionForLog);
    } else if (endpoint === '/order/new' && data) {
      logPayload.hasRedirect = Boolean((data as VPostOrderData).redirectURL);
      logPayload.partnerOrderId = (data as VPostOrderData).partnerOrderId;
      logPayload.itfOrderId = (data as VPostOrderData).itfOrderId;
    } else if (endpoint === '/customer/new' && data) {
      logPayload.clientID = (data as VPostCustomerData).clientID;
    } else if (data && typeof data === 'object') {
      logPayload.dataKeys = Object.keys(data);
    }
    vpostServerLog('response', logPayload);
  }

  return json;
}

export function hasVPostConfig() {
  const config = getVPostConfig();
  return Boolean(config.publicKey && config.secretKey);
}

/**
 * Գանձման ռեժիմ.
 * - single-phase (լռելյայն)՝ գումարը գանձվում է միանգամից, `payment_approved`
 *   (status 1) արդեն նշանակում է հաջող վճարում (առանձին confirm-payment պետք չէ)։
 * - two-phase (`PAYMENT_TWO_PHASE=true`)՝ գումարը սառեցվում է, ապա անհրաժեշտ է
 *   `confirm-payment`՝ վաճառողի հաշվին փոխանցելու համար (վերջնական՝ `payment_deposited`)։
 *
 * Եթե ITF-ի confirm-payment-ը վերադարձնում է «Կարգավորումները չեն գտնվել»,
 * ապա հաշիվը single-phase է, և պետք է թողնել լռելյայն արժեքը (false)։
 */
export function isVPostTwoPhaseEnabled(): boolean {
  const value = (process.env.PAYMENT_TWO_PHASE || '').trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
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
  const body: Record<string, unknown> = {
    customerID: String(payload.customerID),
    firstName: payload.firstName.trim() || 'GoCinema',
    phoneNumber: String(payload.phoneNumber).replace(/\s+/g, ''),
  };
  if (payload.lastName?.trim()) body.lastName = payload.lastName.trim();
  if (payload.email) body.email = payload.email;

  return vpostRequest<VPostCustomerData>('/customer/new', body);
}

function extractPaginate(data: unknown): VPostPaginate | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  const p = d.paginate;
  if (!p || typeof p !== 'object') return undefined;
  const pg = p as Record<string, unknown>;
  return {
    total: typeof pg.total === 'number' ? pg.total : undefined,
    per_page: typeof pg.per_page === 'number' ? pg.per_page : undefined,
    current_page:
      typeof pg.current_page === 'number' ? pg.current_page : undefined,
    last_page: typeof pg.last_page === 'number' ? pg.last_page : undefined,
  };
}

function txDedupeKey(tx: VPostTransactionListItem): string {
  const oid = tx.order?.id ?? '';
  const pid = tx.order?.partnerOrderId ?? '';
  const at = tx.createdAt ?? tx.humandate ?? '';
  return `${oid}-${pid}-${at}`;
}

export function formatVPostDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

export async function listVPostTransactions(payload?: {
  orderID?: number;
  cardID?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
}) {
  const body: Record<string, unknown> = {};
  if (payload?.orderID != null) body.orderID = Number(payload.orderID);
  if (payload?.cardID) body.cardID = payload.cardID;
  if (payload?.startDate) body.startDate = payload.startDate;
  if (payload?.endDate) body.EndDate = payload.endDate;
  if (payload?.page != null) body.page = payload.page;

  return vpostRequest<{
    list?: VPostTransactionListItem[];
    paginate?: VPostPaginate;
  }>('/transactions/list', body);
}

/** Բոլոր էջերը — vPost /transactions/list */
export async function fetchAllVPostTransactions(params?: {
  orderID?: number;
  startDate?: string;
  endDate?: string;
  maxPages?: number;
}): Promise<{
  transactions: VPostTransactionListItem[];
  paginate?: VPostPaginate;
}> {
  const maxPages = params?.maxPages ?? 100;
  const seen = new Set<string>();
  const all: VPostTransactionListItem[] = [];
  let lastPaginate: VPostPaginate | undefined;
  let page = 1;
  let lastPage = 1;

  do {
    const res = await listVPostTransactions({
      orderID: params?.orderID,
      startDate: params?.startDate,
      endDate: params?.endDate,
      page,
    });

    if (!res.status && page === 1) {
      return { transactions: [], paginate: undefined };
    }

    const list = extractTransactionsList(res.data);
    lastPaginate = extractPaginate(res.data) ?? lastPaginate;

    for (const tx of list) {
      const key = txDedupeKey(tx);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(tx);
    }

    if (lastPaginate?.last_page && lastPaginate.last_page > 1) {
      lastPage = lastPaginate.last_page;
      page += 1;
    } else {
      break;
    }
  } while (page <= lastPage && page <= maxPages);

  return {
    transactions: sortTransactionsNewestFirst(all),
    paginate: lastPaginate,
  };
}

export function getVPostTransactionPartnerOrderId(
  tx: VPostTransactionListItem
): number | undefined {
  const pid = tx.order?.partnerOrderId;
  if (pid != null && Number.isFinite(pid) && pid > 0) return pid;

  const desc = tx.description || tx.order?.description || '';
  const fromDesc =
    desc.match(/(?:order|պատվեր)\s*#?\s*(\d+)/i)?.[1] ??
    desc.match(/#(\d+)/)?.[1];
  if (fromDesc) {
    const n = parseInt(fromDesc, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const resp = normalizeResponseObject(tx.response);
  const alt = readResponseField(resp, [
    'partnerOrderId',
    'PartnerOrderId',
    'OrderNumber',
    'orderNumber',
  ]);
  if (alt != null) {
    const n = parseInt(String(alt), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/** confirm/cancel API-ի orderID — partner, ապա ITF fallback */
export function getVPostActionOrderId(
  tx: VPostTransactionListItem
): number | undefined {
  const partner = getVPostTransactionPartnerOrderId(tx);
  if (partner) return partner;
  const itf = tx.order?.id;
  if (itf != null && Number.isFinite(itf) && itf > 0) return itf;
  return undefined;
}

export function getVPostTransactionStatus(tx: VPostTransactionListItem): string {
  const resp = normalizeResponseObject(tx.response);
  const paymentState = String(
    readResponseField(resp, ['PaymentState', 'paymentState']) ?? ''
  ).toLowerCase();
  if (paymentState) return paymentState;
  const orderStatus = tx.order?.status;
  if (orderStatus === 2) return 'payment_deposited';
  if (orderStatus === 1) return 'payment_approved';
  if (orderStatus === 6) return 'payment_declined';
  if (orderStatus === 0) return 'payment_started';
  if (orderStatus === 4) return 'payment_refunded';
  return 'unknown';
}

export async function getVPostTransactionsByOrder(orderID: number) {
  return vpostRequest<{ list?: VPostTransactionListItem[] }>(
    '/transactions/list',
    {
      orderID: Number(orderID),
    }
  );
}

/** Երկու փուլով վճարման հաստատում — սառեցված գումարը գանձելու համար */
export async function confirmVPostPayment(payload: {
  orderID: number;
  customerID: string;
  amount: number;
}) {
  const normalizedAmount = Number(payload.amount.toFixed(2));
  return vpostRequest<VPostConfirmPaymentData>('/order/confirm-payment', {
    orderID: Number(payload.orderID),
    customerID: String(payload.customerID),
    amount: normalizedAmount,
  });
}

/** Վճարման չեղարկում / վերադարձ — սառեցված կամ վճարված գումարը հետ փոխանցելու համար */
export async function cancelVPostPayment(payload: {
  orderID: number;
  amount: number;
}) {
  const normalizedAmount = Number(payload.amount.toFixed(2));
  return vpostRequest<VPostCancelPaymentData>('/order/cancel', {
    orderID: Number(payload.orderID),
    amount: normalizedAmount,
  });
}

export type VPostProviderInfo = {
  responseCode?: string;
  itfOrderId?: string;
  partnerOrderId?: string;
  customerID?: string;
  paymentState?: string;
  orderStatus?: string;
  cardNumber?: string;
  description?: string;
  needsConfirmation?: boolean;
  confirmResponse?: VPostConfirmPaymentData;
  cancelResponse?: VPostCancelPaymentData;
};

function maskCardNumber(raw: string): string {
  if (!raw) return '';
  if (raw.length > 6) return `${raw.slice(0, 4)}***${raw.slice(-4)}`;
  return '***';
}

export function buildVPostProviderInfoFromTransaction(
  tx?: VPostTransactionListItem
): VPostProviderInfo | null {
  if (!tx) return null;
  const resp = normalizeResponseObject(tx.response);
  const responseCode = readResponseField(resp, ['ResponseCode', 'responseCode']);
  const paymentState = String(
    readResponseField(resp, ['PaymentState', 'paymentState']) ?? ''
  );
  const orderStatus = String(
    readResponseField(resp, ['OrderStatus', 'orderStatus']) ?? ''
  );
  const cardRaw = String(
    readResponseField(resp, ['CardNumber', 'cardNumber']) ?? ''
  );
  const description = String(
    readResponseField(resp, ['Description', 'description', 'TrxnDescription']) ??
      ''
  );

  return {
    responseCode: responseCode != null ? String(responseCode) : undefined,
    itfOrderId:
      tx.order?.id != null ? String(tx.order.id) : undefined,
    partnerOrderId:
      tx.order?.partnerOrderId != null
        ? String(tx.order.partnerOrderId)
        : undefined,
    paymentState: paymentState || undefined,
    orderStatus: orderStatus || undefined,
    cardNumber: cardRaw ? maskCardNumber(cardRaw) : undefined,
    description: description || undefined,
    needsConfirmation: isVPostPaymentNeedsConfirmation(tx),
  };
}

/**
 * Երկփուլ վճարման դեպքում գումարը սառեցված է (authorized), բայց դեռ չի գանձվել։
 * Այս վիճակում պետք է կանչել `/order/confirm-payment` (Confirmation)՝ գումարը
 * վաճառողի հաշվին փոխանցելու համար։
 */
export function isVPostPaymentNeedsConfirmation(
  tx?: VPostTransactionListItem
): boolean {
  const state = getVPostPaymentState(tx);
  return state === 'approved' || state === 'autoauthorized';
}

export function mergeVPostProviderInfo(
  fromTx: VPostProviderInfo | null,
  confirmData?: VPostConfirmPaymentData
): VPostProviderInfo | null {
  if (!fromTx && !confirmData) return null;
  const confirmResponse = confirmData
    ? {
        responseCode: confirmData.responseCode,
        itfOrderId: confirmData.itfOrderId,
        partnerOrderId: confirmData.partnerOrderId,
        customerID: confirmData.customerID,
      }
    : undefined;

  if (!fromTx) {
    return {
      responseCode: confirmData?.responseCode,
      itfOrderId: confirmData?.itfOrderId,
      partnerOrderId: confirmData?.partnerOrderId,
      customerID: confirmData?.customerID,
      confirmResponse,
      needsConfirmation: false,
    };
  }

  return {
    ...fromTx,
    responseCode: confirmData?.responseCode ?? fromTx.responseCode,
    itfOrderId: confirmData?.itfOrderId ?? fromTx.itfOrderId,
    partnerOrderId: confirmData?.partnerOrderId ?? fromTx.partnerOrderId,
    customerID: confirmData?.customerID ?? fromTx.customerID,
    confirmResponse,
    needsConfirmation: confirmData
      ? false
      : fromTx.needsConfirmation,
  };
}

/** Փորձում է partner order ID-ով, ապա ITF order ID-ով (fallback) */
export async function fetchVPostTransactionsForOrder(
  partnerOrderId: number,
  alternateItfOrderId?: number
): Promise<{
  envelope: Awaited<ReturnType<typeof getVPostTransactionsByOrder>>;
  list: VPostTransactionListItem[];
  usedOrderId: number;
}> {
  const primary = await getVPostTransactionsByOrder(partnerOrderId);
  let list = getNormalizedTransactionsFromVPostEnvelope(primary);
  let usedOrderId = partnerOrderId;

  if (
    list.length === 0 &&
    alternateItfOrderId &&
    Number.isFinite(alternateItfOrderId) &&
    alternateItfOrderId !== partnerOrderId
  ) {
    const alt = await getVPostTransactionsByOrder(alternateItfOrderId);
    const altList = getNormalizedTransactionsFromVPostEnvelope(alt);
    if (altList.length > 0) {
      return { envelope: alt, list: altList, usedOrderId: alternateItfOrderId };
    }
    if (alt.status && !primary.status) {
      return { envelope: alt, list: altList, usedOrderId: alternateItfOrderId };
    }
  }

  return { envelope: primary, list, usedOrderId };
}

function normalizeResponseObject(
  resp: unknown
): Record<string, unknown> | undefined {
  if (!resp) return undefined;
  if (typeof resp === 'string') {
    try {
      const parsed = JSON.parse(resp) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }
  if (typeof resp === 'object') return resp as Record<string, unknown>;
  return undefined;
}

export function isApprovedResponseCode(code: unknown): boolean {
  const rc = String(code ?? '').trim().toLowerCase();
  return (
    rc === '00' ||
    rc === '0' ||
    rc === '000' ||
    rc === 'approved' ||
    rc === 'success' ||
    rc === 'ok'
  );
}

/** Գործարքի նորմալացված վիճակ ITF/vPost «Կարգավիճակի աղյուսակի» համաձայն։ */
export type VPostPaymentState =
  | 'started' // 0 — գրանցված, չվճարված
  | 'approved' // 1 — հաստատված (սառեցված), դեռ չգանձված
  | 'deposited' // 2 — գումարը փոխանցվել է վաճառողին (ՎՃԱՐՎԱԾ)
  | 'void' // 3 — հատուկ մերժում
  | 'refunded' // 4 — վերադարձված
  | 'autoauthorized' // 5 — հաստատված, սպասում է ACS-ի վերջին հաստատմանը
  | 'declined' // 6 — մերժված
  | 'unknown';

const PAYMENT_STATE_BY_NAME: Record<string, VPostPaymentState> = {
  payment_started: 'started',
  payment_approved: 'approved',
  payment_deposited: 'deposited',
  payment_void: 'void',
  payment_refunded: 'refunded',
  payment_autoauthorized: 'autoauthorized',
  payment_declined: 'declined',
};

const PAYMENT_STATE_BY_CODE: Record<string, VPostPaymentState> = {
  '0': 'started',
  '1': 'approved',
  '2': 'deposited',
  '3': 'void',
  '4': 'refunded',
  '5': 'autoauthorized',
  '6': 'declined',
};

/** Գործարքի վերջնական վիճակը՝ PaymentState-ով, ապա OrderStatus/internal կոդով։ */
export function getVPostPaymentState(
  tx?: VPostTransactionListItem
): VPostPaymentState {
  if (!tx) return 'unknown';
  const resp = normalizeResponseObject(tx.response);
  const paymentState = String(
    readResponseField(resp, ['PaymentState', 'paymentState']) ?? ''
  ).toLowerCase();
  if (paymentState && PAYMENT_STATE_BY_NAME[paymentState]) {
    return PAYMENT_STATE_BY_NAME[paymentState];
  }

  const orderStatus = String(
    readResponseField(resp, ['OrderStatus', 'orderStatus']) ?? ''
  ).trim();
  const code =
    orderStatus || (tx.order?.status != null ? String(tx.order.status) : '');
  return PAYMENT_STATE_BY_CODE[code] ?? 'unknown';
}

/**
 * Վերջնական «վճարված» վիճակ — գումարը փաստացի փոխանցվել է վաճառողի հաշվին
 * (`payment_deposited` / OrderStatus 2)։ ResponseCode `00`-ը միայն authorization
 * է նշանակում, ոչ գանձում, ուստի «վճարված» որոշման համար օգտագործում ենք սա։
 */
export function isVPostPaymentDeposited(
  tx?: VPostTransactionListItem
): boolean {
  return getVPostPaymentState(tx) === 'deposited';
}

/** Հետընթաց համատեղելիություն. authorized կամ ավելի բարձր (ՈՉ paid-ի որոշման համար)։ */
export function isVPostPaymentApproved(
  tx?: VPostTransactionListItem
): boolean {
  const state = getVPostPaymentState(tx);
  return (
    state === 'deposited' ||
    state === 'approved' ||
    state === 'autoauthorized'
  );
}

export function isVPostPaymentDeclined(tx?: VPostTransactionListItem): boolean {
  const state = getVPostPaymentState(tx);
  return state === 'declined' || state === 'void';
}

/** Գործարքի գումարը՝ գանձման ստուգման համար (թերավճարից պաշտպանվելու)։ */
export function getVPostTransactionAmount(
  tx?: VPostTransactionListItem
): number | undefined {
  if (!tx) return undefined;
  const resp = normalizeResponseObject(tx.response);
  const candidates: unknown[] = [
    readResponseField(resp, ['DepositedAmount']),
    readResponseField(resp, ['ApprovedAmount']),
    readResponseField(resp, ['Amount']),
    tx.order?.amount,
    tx.amount,
  ];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const value =
      typeof candidate === 'number'
        ? candidate
        : parseFloat(String(candidate));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}
