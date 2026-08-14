/**
 * Գործնական ծախսեր (P&L)՝ ՀՀ հարկային օրենսգրքի տրամաբանությամբ։
 *
 * Շրջհարկի նվազեցման համար (հոդ. 258 մաս 6) հաշվի են առնվում միայն
 * փաստաթղթավորված՝ գործունեության, վարչական և իրացման ծախսերը։
 * Դրոշմանիշային վճարը, պետական տուրքը, եկամտային հարկը, գործուղումը,
 * ներկայացուցչականը և հիմնական միջոցները շրջհարկը չեն նվազեցնում,
 * բայց գործնական շահույթում ծախս են։
 */

export const EXPENSE_CATEGORIES = [
  'rent',
  'utilities',
  'supplies',
  'maintenance',
  'marketing',
  'communication',
  'insurance',
  'bank_fees',
  'fuel',
  'salary',
  'social_payment',
  'stamp_duty',
  'state_duty',
  'income_tax',
  'travel',
  'representation',
  'fixed_asset',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseCategoryGroupId =
  | 'operations'
  | 'payroll'
  | 'statutory'
  | 'restricted'
  | 'other';

export interface ExpenseCategoryMeta {
  label: string;
  hint: string;
  group: ExpenseCategoryGroupId;
  /** true = կարող է նվազեցնել շրջհարկը, եթե կա հաշիվ/վճարման փաստաթուղթ */
  reducesTurnoverTax: boolean;
}

export const EXPENSE_CATEGORY_META: Record<
  ExpenseCategory,
  ExpenseCategoryMeta
> = {
  rent: {
    label: 'Վարձակալություն',
    hint: 'Տարածքի վարձ։ Վարչական ծախս է — շրջհարկը նվազեցնում է հաշիվով։',
    group: 'operations',
    reducesTurnoverTax: true,
  },
  utilities: {
    label: 'Կոմունալ',
    hint: 'Էլեկտրականություն, ջուր, գազ, աղբահանություն։ Վարչական ծախս է։',
    group: 'operations',
    reducesTurnoverTax: true,
  },
  supplies: {
    label: 'Նյութեր և մատակարարում',
    hint: 'Գործունեության համար գնված նյութեր (ոչ վերավաճառքի ապրանք)։',
    group: 'operations',
    reducesTurnoverTax: true,
  },
  maintenance: {
    label: 'Սպասարկում և վերանորոգում',
    hint: 'Ընթացիկ սպասարկում։ Կապիտալ վերանորոգումը/հիմնական միջոցը չի նվազեցնում շրջհարկը։',
    group: 'operations',
    reducesTurnoverTax: true,
  },
  marketing: {
    label: 'Մարքեթինգ / գովազդ',
    hint: 'Ներքին մարքեթինգային ծախս։ Այստեղից շրջհարկը չի նվազում։ Նվազեցման համար գրանցեք փաստաթղթավորված հաշիվ հաշվապահությունում։',
    group: 'operations',
    reducesTurnoverTax: false,
  },
  communication: {
    label: 'Կապ և ինտերնետ',
    hint: 'Հեռախոս, ինտերնետ, փոստ։ Վարչական ծախս է։',
    group: 'operations',
    reducesTurnoverTax: true,
  },
  insurance: {
    label: 'Ապահովագրություն',
    hint: 'Գույքի/պատասխանատվության ապահովագրություն։ Վարչական ծախս է։',
    group: 'operations',
    reducesTurnoverTax: true,
  },
  bank_fees: {
    label: 'Բանկային միջնորդավճար',
    hint: 'Հաշվի սպասարկում, POS, փոխանցման վճար։ Վարչական ծախս է։',
    group: 'operations',
    reducesTurnoverTax: true,
  },
  fuel: {
    label: 'Վառելիք / տեղափոխում',
    hint: 'Ընթացիկ տեղափոխման ծախս։ Գործուղումը առանձին է և շրջհարկը չի նվազեցնում։',
    group: 'operations',
    reducesTurnoverTax: true,
  },
  salary: {
    label: 'Աշխատավարձ',
    hint: 'Աշխատակիցների աշխատավարձ։ Վարչական/գործունեության ծախս է։',
    group: 'payroll',
    reducesTurnoverTax: true,
  },
  social_payment: {
    label: 'Սոցիալական վճար',
    hint: 'ԱՁ շրջհարկ՝ 5 000 ֏/ամիս (եռամսյակում 15 000 ֏)։ Վճարում՝ հաջորդ ամսվա 20-ը։',
    group: 'payroll',
    reducesTurnoverTax: true,
  },
  stamp_duty: {
    label: 'Դրոշմանիշային վճար',
    hint: 'Տարեկան վճար՝ մինչև հաջորդ տարվա ապրիլի 20-ը։ 2026-ից՝ մինչև 12 մլն ֏ շրջանառություն → 12 000 ֏, ավելի → 120 000 ֏։ Շրջհարկը չի նվազեցնում։',
    group: 'statutory',
    reducesTurnoverTax: false,
  },
  state_duty: {
    label: 'Պետական տուրք',
    hint: 'Գումարը ֆիքսված չէ — կախված է տուրքի տեսակից։ Վճարվում է հայտի/գործարքի պահին։ Շրջհարկը չի նվազեցնում։',
    group: 'statutory',
    reducesTurnoverTax: false,
  },
  income_tax: {
    label: 'Եկամտային հարկ',
    hint: 'ԱՁ շրջհարկ՝ ֆիքսված 5 000 ֏/ամիս (եռամսյակում 15 000 ֏)։ Վճարում՝ հաջորդ ամսվա 20-ը։ Շրջհարկը չի նվազեցնում։',
    group: 'statutory',
    reducesTurnoverTax: false,
  },
  travel: {
    label: 'Գործուղում',
    hint: 'Հոդ. 258 մաս 6՝ շրջհարկի գումարից չի նվազեցվում։',
    group: 'restricted',
    reducesTurnoverTax: false,
  },
  representation: {
    label: 'Ներկայացուցչական',
    hint: 'Հոդ. 258 մաս 6՝ շրջհարկի գումարից չի նվազեցվում։',
    group: 'restricted',
    reducesTurnoverTax: false,
  },
  fixed_asset: {
    label: 'Հիմնական միջոց / կապիտալ',
    hint: 'Ձեռքբերում, կառուցում, ամորտիզացիա։ Հոդ. 258 մաս 6՝ շրջհարկը չի նվազեցնում։',
    group: 'restricted',
    reducesTurnoverTax: false,
  },
  other: {
    label: 'Այլ ծախս',
    hint: 'Եթե կա հաշիվ և կապված է գործունեության հետ — կարող է նվազեցնել շրջհարկը։',
    group: 'other',
    reducesTurnoverTax: true,
  },
};

export const EXPENSE_CATEGORY_GROUPS: Array<{
  id: ExpenseCategoryGroupId;
  label: string;
  items: ExpenseCategory[];
}> = [
  {
    id: 'statutory',
    label: 'Պարտադիր վճարներ և հարկեր',
    items: ['stamp_duty', 'state_duty', 'social_payment', 'income_tax'],
  },
  {
    id: 'operations',
    label: 'Գործունեության և վարչական ծախսեր',
    items: [
      'rent',
      'utilities',
      'salary',
      'marketing',
      'communication',
      'insurance',
      'bank_fees',
      'fuel',
      'supplies',
      'maintenance',
    ],
  },
  {
    id: 'restricted',
    label: 'Օրենքով չնվազեցվող (հոդ. 258 մաս 6)',
    items: ['travel', 'representation', 'fixed_asset'],
  },
  {
    id: 'other',
    label: 'Այլ',
    items: ['other'],
  },
];

export const EXPENSE_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(
    EXPENSE_CATEGORIES.map((c) => [c, EXPENSE_CATEGORY_META[c].label])
  );

export function normalizeExpenseCategory(value: unknown): ExpenseCategory {
  const str = String(value ?? '').trim();
  return (EXPENSE_CATEGORIES as readonly string[]).includes(str)
    ? (str as ExpenseCategory)
    : 'other';
}

export function expenseCategoryLabel(category: string): string {
  const str = String(category ?? '').trim();
  if ((EXPENSE_CATEGORIES as readonly string[]).includes(str)) {
    return EXPENSE_CATEGORY_META[str as ExpenseCategory].label;
  }
  return (
    EXPENSE_CATEGORY_LABELS[str] || str || EXPENSE_CATEGORY_META.other.label
  );
}

export function expenseCategoryHint(category: string): string {
  const str = String(category ?? '').trim();
  if ((EXPENSE_CATEGORIES as readonly string[]).includes(str)) {
    return EXPENSE_CATEGORY_META[str as ExpenseCategory].hint;
  }
  return EXPENSE_CATEGORY_META.other.hint;
}

export function expenseReducesTurnoverTax(category: string): boolean {
  const str = String(category ?? '').trim();
  if ((EXPENSE_CATEGORIES as readonly string[]).includes(str)) {
    return EXPENSE_CATEGORY_META[str as ExpenseCategory].reducesTurnoverTax;
  }
  return true;
}

export interface ExpenseRow {
  id: number;
  title: string;
  amount: number;
  category: string;
  spentBy: string;
  note: string | null;
  expenseDate: string;
  createdByName: string | null;
  createdAt: string;
}

export interface ExpenseDailyPoint {
  dateKey: string;
  total: number;
  count: number;
}

export interface ExpenseWeeklyPoint {
  weekStart: string;
  total: number;
  count: number;
}

export interface ExpenseCategoryPoint {
  category: string;
  total: number;
  count: number;
}

export interface ExpensePersonPoint {
  spentBy: string;
  total: number;
  count: number;
}

export interface ExpenseAnalytics {
  total: number;
  count: number;
  averagePerDay: number;
  daysCount: number;
  daily: ExpenseDailyPoint[];
  weekly: ExpenseWeeklyPoint[];
  byCategory: ExpenseCategoryPoint[];
  byPerson: ExpensePersonPoint[];
}

export interface ExpensesResult {
  rows: ExpenseRow[];
  analytics: ExpenseAnalytics;
}
