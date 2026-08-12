import type { TaxStream } from '@/lib/turnover-tax';

export const TAX_DOCUMENT_KINDS = ['producer', 'purchase', 'other'] as const;
export type TaxDocumentKind = (typeof TAX_DOCUMENT_KINDS)[number];

export const TAX_DOCUMENT_KIND_LABELS: Record<TaxDocumentKind, string> = {
  producer: 'Ֆիլմ արտադրող',
  purchase: 'Ապրանքի գնում',
  other: 'Այլ փաստաթղթավորված',
};

export const TAX_STREAM_LABELS: Record<TaxStream, string> = {
  tickets: 'Տոմսեր (59.14)',
  products: 'Ապրանքներ (47.x)',
};

/**
 * Ծախսի տեսակներ՝ հոդ. 258 մաս 6։
 * Չնվազեցվող՝ հիմնական միջոցներ/ոչ նյութական ակտիվներ, կապիտալ ծախսեր,
 * ամորտիզացիա, գործուղում, ներկայացուցչական, անվճար ստացված։
 */
export const TAX_COST_TYPES = [
  'goods',
  'service',
  'fixed_asset',
  'capital',
  'depreciation',
  'travel',
  'representation',
  'free_of_charge',
  'other',
] as const;
export type TaxCostType = (typeof TAX_COST_TYPES)[number];

export const TAX_COST_TYPE_LABELS: Record<TaxCostType, string> = {
  goods: 'Ապրանք վերավաճառքի համար',
  service: 'Ծառայություն / աշխատանք',
  fixed_asset: 'Հիմնական միջոց / ոչ նյութական ակտիվ',
  capital: 'Կապիտալ ծախս',
  depreciation: 'Ամորտիզացիա',
  travel: 'Գործուղում',
  representation: 'Ներկայացուցչական',
  free_of_charge: 'Անվճար ստացված',
  other: 'Այլ',
};

/** Օրենքով շրջհարկը չնվազեցնող ծախսատեսակներ */
export const NON_DEDUCTIBLE_COST_TYPES: readonly TaxCostType[] = [
  'fixed_asset',
  'capital',
  'depreciation',
  'travel',
  'representation',
  'free_of_charge',
];

export function normalizeTaxCostType(value: unknown): TaxCostType {
  const str = String(value ?? '').trim();
  return (TAX_COST_TYPES as readonly string[]).includes(str)
    ? (str as TaxCostType)
    : 'other';
}

export function isDeductibleCostType(costType: string): boolean {
  return !(NON_DEDUCTIBLE_COST_TYPES as readonly string[]).includes(costType);
}

export function normalizeTaxDocumentKind(value: unknown): TaxDocumentKind {
  const str = String(value ?? '').trim();
  return (TAX_DOCUMENT_KINDS as readonly string[]).includes(str)
    ? (str as TaxDocumentKind)
    : 'other';
}

export function normalizeTaxStream(value: unknown): TaxStream {
  return value === 'products' ? 'products' : 'tickets';
}

/** kind-ից լռելյայն հոսք */
export function defaultStreamForKind(kind: TaxDocumentKind): TaxStream {
  return kind === 'purchase' ? 'products' : 'tickets';
}

export function defaultCostTypeForKind(kind: TaxDocumentKind): TaxCostType {
  if (kind === 'purchase') return 'goods';
  if (kind === 'producer') return 'service';
  return 'other';
}

// ── Եռամսյակներ (օրենսդրական հաշվետու ժամանակաշրջան) ────────────────────────

export function quarterOfMonth(monthIndex: number): 1 | 2 | 3 | 4 {
  return (Math.floor(monthIndex / 3) + 1) as 1 | 2 | 3 | 4;
}

export function quarterBounds(year: number, quarter: number): { from: Date; to: Date } {
  const q = Math.min(4, Math.max(1, Math.floor(quarter)));
  const from = new Date(year, (q - 1) * 3, 1, 0, 0, 0, 0);
  const to = new Date(year, q * 3, 0, 23, 59, 59, 999);
  return { from, to };
}

/** Հայտարարագրման/վճարման վերջնաժամկետ՝ եռամսյակին հաջորդող ամսվա 20-ը */
export function quarterFilingDeadline(year: number, quarter: number): Date {
  const q = Math.min(4, Math.max(1, Math.floor(quarter)));
  return new Date(year, q * 3, 20, 23, 59, 59, 999);
}

export function quarterLabel(year: number, quarter: number): string {
  return `${year} · ${quarter}-ին եռամսյակ`;
}

export interface TaxDocumentRow {
  id: number;
  kind: string;
  stream: string;
  costType: string;
  deductible: boolean;
  title: string;
  supplierName: string | null;
  supplierTin: string | null;
  invoiceNumber: string | null;
  amount: number;
  amountExVat: number | null;
  vatAmount: number | null;
  documentDate: string;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface AccountingSettingsRow {
  id: number;
  ticketProducerSharePercent: number;
  annualTurnoverThresholdAmd: number;
  note: string | null;
}

export interface ProductCategoryRevenue {
  category: string;
  revenue: number;
  cost: number;
  quantity: number;
}

export interface StreamTaxView {
  turnover: number;
  documentedCosts: number;
  nonDeductibleCosts: number;
  grossTax: number;
  deductionFromCosts: number;
  carriedInDeduction: number;
  availableDeduction: number;
  appliedDeduction: number;
  carriedOutDeduction: number;
  minTax: number;
  taxDue: number;
  effectiveRate: number;
  floorApplied: boolean;
  adgCode: string;
  labelHy: string;
  activityHy: string;
  baseRate: number;
  deductionRate: number;
  minRate: number;
}

export interface QuarterHistoryPoint {
  year: number;
  quarter: number;
  label: string;
  ticketsTurnover: number;
  productsTurnover: number;
  taxDue: number;
}

export interface AccountingWarning {
  level: 'error' | 'warning' | 'info';
  message: string;
}

export interface AccountingDashboard {
  period: {
    year: number;
    quarter: number;
    label: string;
    from: string;
    to: string;
    filingDeadline: string;
    isClosed: boolean;
  };
  settings: AccountingSettingsRow;
  revenue: {
    /** Հարկման բազա՝ ակտիվ (չվերադարձված) տոմսերի գումարը */
    ticketsNet: number;
    ticketsCount: number;
    /** Այս ժամանակաշրջանում ձևակերպված տոմսի վերադարձներ (բազայից արդեն դուրս են) */
    ticketRefundsProcessed: number;
    ticketRefundsCount: number;
    /** Հարկման բազա՝ ապրանքի ակտիվ տողերը (վերադարձվածը հանված է order-ից) */
    productsNet: number;
    /** Այս ժամանակաշրջանում ՀԴՄ-ով ձևակերպված ապրանքի վերադարձներ (տեղեկատվական) */
    productReturnsProcessed: number;
    productsCost: number;
    productsProfit: number;
    byProductCategory: ProductCategoryRevenue[];
  };
  fiscal: {
    salesTotal: number;
    returnsTotal: number;
    salesCount: number;
    returnsCount: number;
    netTotal: number;
    failedCount: number;
    /** Վերադարձներ, որոնց սկզբնական վաճառքը նախորդ եռամսյակում է եղել */
    retroactiveRefunds: number;
    difference: number;
  };
  yearToDate: {
    turnover: number;
    threshold: number;
    remaining: number;
    percentUsed: number;
    taxPaidEstimate: number;
  };
  documents: {
    ticketsCosts: number;
    productsCosts: number;
    nonDeductibleTotal: number;
    rows: TaxDocumentRow[];
  };
  operational: {
    producerSharePercent: number;
    producerShareAmount: number;
    cinemaTicketKeep: number;
    estimatedOperatingProfit: number;
  };
  tax: {
    tickets: StreamTaxView;
    products: StreamTaxView;
    totalTurnover: number;
    totalDocumentedCosts: number;
    totalTaxDue: number;
    totalCarriedOutDeduction: number;
  };
  history: QuarterHistoryPoint[];
  warnings: AccountingWarning[];
  disclaimer: string;
}
