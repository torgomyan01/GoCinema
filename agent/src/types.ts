export interface HdmOperator {
  id: number;
  name: string;
  deps: number[];
}

export interface HdmDepartment {
  id: number;
  name: string;
  type: number;
}

export interface HdmOperatorsResponse {
  c?: HdmOperator[];
  d?: HdmDepartment[];
}

export interface HdmLoginResponse {
  key: string;
}

export interface HdmReceiptItem {
  dep: number;
  qty: number;
  price: number;
  productCode: string;
  productName: string;
  adgCode: string;
  unit: string;
  discount?: number;
  discountType?: number;
}

export interface HdmPrintReceiptRequest {
  seq: number;
  paidAmount: number;
  paidAmountCard: number;
  partialAmount?: number;
  prePaymentAmount?: number;
  mode: 1 | 2 | 3;
  partnerTin?: string | null;
  dep?: number;
  useExtPOS?: boolean;
  PaymentSystem?: number | null;
  rrn?: string;
  terminalId?: string;
  eMarks?: string[];
  items?: HdmReceiptItem[] | null;
}

export interface HdmPrintReceiptResponse {
  rseq: number;
  crn: string;
  sn: string;
  tin: string;
  taxpayer: string;
  address: string;
  time: number;
  fiscal: string;
  lottery?: string;
  prize?: number;
  total: number;
  change: number;
  qr: string;
  emarksCount?: string | number;
  verificationNumber?: string | number;
}

export interface HdmReturnReceiptRequest {
  seq: number;
  crn: string;
  returnTicketId: number;
  cashAmountForReturn?: number;
  cardAmountForReturn?: number;
  prePaymentAmountForReturn?: number;
  rrn?: string;
  terminalId?: string;
  eMarks?: string[];
  returnItemList?: Array<{ rpid: number; quantity: number }>;
}

/** Վերադարձի կտրոնի պատասխանը նույն կառուցվածքն ունի, ինչ վաճառքինը */
export type HdmReturnReceiptResponse = HdmPrintReceiptResponse;

export interface HdmEmarkCheckRequest {
  seq: number;
  eMark: string;
}

export interface HdmEmarkCheckResponse {
  ok?: boolean;
  valid?: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface HdmErrorBody {
  error?: string;
  message?: string;
  code?: number;
  [key: string]: unknown;
}

/** GoCinema → agent HTTP API */
export type PaymentMethod = 'cash' | 'card';

export interface AgentReceiptItem {
  productCode: string;
  productName: string;
  price: number;
  qty?: number;
  adgCode?: string;
  dep?: number;
  unit?: string;
}

export interface AgentPrintReceiptBody {
  paymentMethod: PaymentMethod;
  total: number;
  items: AgentReceiptItem[];
  eMarks?: string[];
  useExtPOS?: boolean;
}

export interface AgentPrintReceiptResult {
  ok: true;
  fiscal: HdmPrintReceiptResponse;
}

/** GoCinema → agent՝ վերադարձի կտրոնի հարցում (լրիվ կամ մասնակի վերադարձ) */
export interface AgentReturnReceiptBody {
  crn: string;
  returnTicketId: number;
  paymentMethod: PaymentMethod;
  /** Մասնակի վերադարձի դեպքում՝ վերադարձվող գումարը (բացակայության դեպքում՝ լրիվ) */
  amount?: number;
  eMarks?: string[];
  returnItemList?: Array<{ rpid: number; quantity: number }>;
}

export interface AgentReturnReceiptResult {
  ok: true;
  fiscal: HdmReturnReceiptResponse;
}

export interface AgentErrorResult {
  ok: false;
  error: string;
  code?: number;
  details?: unknown;
}

export type AgentResult<T> =
  | ({ ok: true } & T)
  | AgentErrorResult;
