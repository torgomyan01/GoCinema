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
 * Ծախսի տեսակներ՝ ՀՀ հարկային օրենսգիրք հոդ. 258 մաս 6։
 * Նվազեցվող՝ գործունեության, ապրանքի ինքնաարժեք, վարչական և իրացման ծախսեր։
 * Չնվազեցվող՝ հիմնական միջոց, կապիտալ, ամորտիզացիա, գործուղում,
 * ներկայացուցչական, անվճար ստացված, դրոշմանիշային վճար, պետական տուրք, եկամտային հարկ։
 */
export const TAX_COST_TYPES = [
  'goods',
  'service',
  'admin',
  'selling',
  'rent',
  'utilities',
  'salary',
  'social_payment',
  'insurance',
  'marketing',
  'communication',
  'bank_fees',
  'maintenance',
  'stamp_duty',
  'state_duty',
  'income_tax',
  'fixed_asset',
  'capital',
  'depreciation',
  'liquidation',
  'travel',
  'representation',
  'free_of_charge',
  'other',
] as const;
export type TaxCostType = (typeof TAX_COST_TYPES)[number];

export interface TaxCostTypeMeta {
  label: string;
  hint: string;
  deductible: boolean;
}

export const TAX_COST_TYPE_META: Record<TaxCostType, TaxCostTypeMeta> = {
  goods: {
    label: 'Ապրանք վերավաճառքի համար',
    hint: 'Առևտրի ինքնաարժեք (47.x)։ Նվազեցում՝ ծախսի 9.5%-ով։',
    deductible: true,
  },
  service: {
    label: 'Ծառայություն / աշխատանք',
    hint: 'Գործունեության հետ ուղղակի կապված ծառայություն (օր.՝ արտադրողի հաշիվ)։',
    deductible: true,
  },
  admin: {
    label: 'Վարչական ծախս',
    hint: 'Հոդ. 258՝ վարչական ծախսերը նվազեցնում են շրջհարկը։',
    deductible: true,
  },
  selling: {
    label: 'Իրացման ծախս',
    hint: 'Հոդ. 258՝ իրացման ծախսերը նվազեցնում են շրջհարկը։',
    deductible: true,
  },
  rent: {
    label: 'Վարձակալություն',
    hint: 'Տարածքի վարձ — վարչական ծախս։',
    deductible: true,
  },
  utilities: {
    label: 'Կոմունալ',
    hint: 'Էլեկտրականություն, ջուր, գազ — վարչական ծախս։',
    deductible: true,
  },
  salary: {
    label: 'Աշխատավարձ',
    hint: 'Աշխատակիցների աշխատավարձ — վարչական/գործունեության ծախս։',
    deductible: true,
  },
  social_payment: {
    label: 'Սոցիալական վճար',
    hint: 'Պարտադիր սոցիալական վճար։ Աշխատանքային ծախս է, նվազեցնում է շրջհարկը փաստաթղթով։',
    deductible: true,
  },
  insurance: {
    label: 'Ապահովագրություն',
    hint: 'Գույքի/պատասխանատվության ապահովագրություն — վարչական ծախս։',
    deductible: true,
  },
  marketing: {
    label: 'Մարքեթինգ / գովազդ',
    hint: 'Facebook, Instagram, Google գովազդ։ Իրացման ծախս է։ Եթե գովազդը և՛ տոմսի, և՛ ապրանքի համար է — բաժանեք ըստ շրջանառության տեսակարար կշռի։ Ներկայացուցչականը առանձին է։',
    deductible: true,
  },
  communication: {
    label: 'Կապ և ինտերնետ',
    hint: 'Հեռախոս, ինտերնետ — վարչական ծախս։',
    deductible: true,
  },
  bank_fees: {
    label: 'Բանկային միջնորդավճար',
    hint: 'Հաշվի սպասարկում, POS — վարչական ծախս։',
    deductible: true,
  },
  maintenance: {
    label: 'Սպասարկում և վերանորոգում',
    hint: 'Ընթացիկ սպասարկում։ Կապիտալ վերանորոգումը չի նվազեցնում։',
    deductible: true,
  },
  stamp_duty: {
    label: 'Դրոշմանիշային վճար',
    hint: 'Օրենքով պարտադիր վճար է (սովորաբար տարեկան, մինչև ապրիլի 20)։ Գործնական ծախս է, շրջհարկը չի նվազեցնում։',
    deductible: false,
  },
  state_duty: {
    label: 'Պետական տուրք',
    hint: 'Պետական տուրքեր և թույլտվություններ։ Շրջհարկը չի նվազեցնում։',
    deductible: false,
  },
  income_tax: {
    label: 'Եկամտային հարկ',
    hint: 'Եկամտային հարկը շրջհարկի նվազեցման բանաձևում չի մասնակցում։',
    deductible: false,
  },
  fixed_asset: {
    label: 'Հիմնական միջոց / ոչ նյութական ակտիվ',
    hint: 'Հոդ. 258 մաս 6՝ ձեռքբերումը/ստեղծումը չի նվազեցնում շրջհարկը։',
    deductible: false,
  },
  capital: {
    label: 'Կապիտալ ծախս',
    hint: 'Հոդ. 258 մաս 6՝ կապիտալ ծախսը չի նվազեցնում շրջհարկը։',
    deductible: false,
  },
  depreciation: {
    label: 'Ամորտիզացիա',
    hint: 'Հոդ. 258 մաս 6՝ ամորտիզացիան չի նվազեցնում շրջհարկը։',
    deductible: false,
  },
  liquidation: {
    label: 'Հիմնական միջոցի լուծարում',
    hint: 'Հոդ. 258 մաս 6՝ լուծարման ծախսը չի նվազեցնում շրջհարկը։',
    deductible: false,
  },
  travel: {
    label: 'Գործուղում',
    hint: 'Հոդ. 258 մաս 6՝ գործուղումը չի նվազեցնում շրջհարկը։',
    deductible: false,
  },
  representation: {
    label: 'Ներկայացուցչական',
    hint: 'Հոդ. 258 մաս 6՝ ներկայացուցչական ծախսը չի նվազեցնում շրջհարկը։',
    deductible: false,
  },
  free_of_charge: {
    label: 'Անվճար ստացված',
    hint: 'Հոդ. 258 մաս 6՝ անվճար ստացված ակտիվը/ծառայությունը չի նվազեցնում։',
    deductible: false,
  },
  other: {
    label: 'Այլ փաստաթղթավորված ծախս',
    hint: 'Եթե կապված է գործունեության հետ և ունի հաշիվ — նվազեցնում է շրջհարկը։',
    deductible: true,
  },
};

export const TAX_COST_TYPE_LABELS: Record<TaxCostType, string> =
  Object.fromEntries(
    TAX_COST_TYPES.map((t) => [t, TAX_COST_TYPE_META[t].label])
  ) as Record<TaxCostType, string>;

export const TAX_COST_TYPE_GROUPS: Array<{
  label: string;
  items: TaxCostType[];
}> = [
  {
    label: 'Նվազեցնում է շրջհարկը (հոդ. 258)',
    items: [
      'goods',
      'service',
      'admin',
      'selling',
      'rent',
      'utilities',
      'salary',
      'social_payment',
      'insurance',
      'marketing',
      'communication',
      'bank_fees',
      'maintenance',
      'other',
    ],
  },
  {
    label: 'Չի նվազեցնում շրջհարկը',
    items: [
      'stamp_duty',
      'state_duty',
      'income_tax',
      'fixed_asset',
      'capital',
      'depreciation',
      'liquidation',
      'travel',
      'representation',
      'free_of_charge',
    ],
  },
];

/** Օրենքով շրջհարկը չնվազեցնող ծախսատեսակներ */
export const NON_DEDUCTIBLE_COST_TYPES: readonly TaxCostType[] =
  TAX_COST_TYPES.filter((t) => !TAX_COST_TYPE_META[t].deductible);

export function normalizeTaxCostType(value: unknown): TaxCostType {
  const str = String(value ?? '').trim();
  return (TAX_COST_TYPES as readonly string[]).includes(str)
    ? (str as TaxCostType)
    : 'other';
}

export function isDeductibleCostType(costType: string): boolean {
  if ((TAX_COST_TYPES as readonly string[]).includes(costType)) {
    return TAX_COST_TYPE_META[costType as TaxCostType].deductible;
  }
  return !(NON_DEDUCTIBLE_COST_TYPES as readonly string[]).includes(costType);
}

export function taxCostTypeHint(costType: string): string {
  if ((TAX_COST_TYPES as readonly string[]).includes(costType)) {
    return TAX_COST_TYPE_META[costType as TaxCostType].hint;
  }
  return TAX_COST_TYPE_META.other.hint;
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

export function quarterBounds(
  year: number,
  quarter: number
): { from: Date; to: Date } {
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

export interface AccountingWarningSample {
  ref: string;
  amount: number;
  date: string;
  note: string;
  /** Եթե կա՝ կարելի է ջնջել fiscal_receipt գրառումը */
  receiptId?: number;
  ticketId?: number;
  orderId?: number;
  badge?: string;
}

export interface AccountingWarningFinding {
  title: string;
  description: string;
  count: number;
  amount: number;
  samples: AccountingWarningSample[];
  tone?: 'info' | 'issue';
  selectable?: boolean;
}

export interface AccountingWarningDetails {
  title: string;
  comparison: Array<{ label: string; value: string }>;
  findings: AccountingWarningFinding[];
  hints: string[];
  href?: { label: string; href: string };
  onlineTurnover?: number;
  onlineCount?: number;
  residualDifference?: number;
  /** ՀԴՄ կտրոններ, որոնք կապված են այս եռամսյակի մուտք/պատվերին */
  comparableFiscalNet?: number;
  accountingWithoutOnline?: number;
}

export interface AccountingWarning {
  level: 'error' | 'warning' | 'info';
  message: string;
  details?: AccountingWarningDetails;
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
    /** Հարկման բազա՝ տպված ՀԴՄ տոմսային տողեր (վաճառք − վերադարձ) */
    ticketsNet: number;
    ticketsCount: number;
    /** Այս եռամսյակում տպված տոմսի վերադարձի կտրոններ */
    ticketRefundsProcessed: number;
    ticketRefundsCount: number;
    /** Հարկման բազա՝ տպված ՀԴՄ ապրանքային տողեր (վաճառք − վերադարձ) */
    productsNet: number;
    /** Այս եռամսյակում տպված ապրանքի վերադարձի կտրոններ */
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
    /** Facebook/մարքեթինգ փաստաթղթավորված ծախս՝ նվազեցնում է շրջհարկը */
    marketingTotal: number;
    marketingCount: number;
  };
  operational: {
    producerSharePercent: number;
    producerShareAmount: number;
    cinemaTicketKeep: number;
    operatingExpensesTotal: number;
    statutoryPaymentsTotal: number;
    expensesByCategory: Array<{
      category: string;
      label: string;
      hint: string;
      amount: number;
      count: number;
      reducesTurnoverTax: boolean;
    }>;
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
