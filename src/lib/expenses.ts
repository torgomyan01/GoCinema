export const EXPENSE_CATEGORIES = [
  'rent',
  'utilities',
  'salary',
  'supplies',
  'maintenance',
  'marketing',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: 'Վարձակալություն',
  utilities: 'Կոմունալ',
  salary: 'Աշխատավարձ',
  supplies: 'Մատակարարում',
  maintenance: 'Սպասարկում',
  marketing: 'Մարքեթինգ',
  other: 'Այլ',
};

export function normalizeExpenseCategory(value: unknown): ExpenseCategory {
  const str = String(value ?? '').trim();
  return (EXPENSE_CATEGORIES as readonly string[]).includes(str)
    ? (str as ExpenseCategory)
    : 'other';
}

export function expenseCategoryLabel(category: string): string {
  return EXPENSE_CATEGORY_LABELS[category] || category;
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
