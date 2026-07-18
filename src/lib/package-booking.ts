/**
 * Փաթեթների պատվերներ (Private Party, Corporate, VIP Date)։
 * Փաթեթի պատվերի ժամին (±buffer) ցուցադրություն ավելացնել չի կարելի,
 * և հակառակը՝ ցուցադրության ժամին փաթեթի պատվեր չի կարելի։
 */

/** Ժամային buffer փաթեթի պատվերի սկզբից առաջ և ավարտից հետո (նախապատրաստում/մաքրություն)։ */
export const PACKAGE_BUFFER_MINUTES = 30;
export const PACKAGE_BUFFER_MS = PACKAGE_BUFFER_MINUTES * 60 * 1000;

export type PackageBookingStatus = 'pending' | 'confirmed' | 'cancelled';

export const PACKAGE_TYPES = [
  'private-party',
  'corporate',
  'vip-date',
  'other',
] as const;

export type PackageType = (typeof PACKAGE_TYPES)[number];

export const PACKAGE_TYPE_LABELS: Record<string, string> = {
  'private-party': 'Փակ Կինոդիտում',
  corporate: 'Կորպորատիվ / Պրեզենտացիա',
  'vip-date': 'Ռոմանտիկ Ժամադրություն',
  other: 'Այլ',
};

export const PACKAGE_STATUS_LABELS: Record<string, string> = {
  pending: 'Սպասվող',
  confirmed: 'Հաստատված',
  cancelled: 'Չեղարկված',
};

export function packageTypeLabelHy(type: string): string {
  return PACKAGE_TYPE_LABELS[type] ?? type;
}

export function packageStatusLabelHy(status: string): string {
  return PACKAGE_STATUS_LABELS[status] ?? status;
}

export interface PackageBookingRow {
  id: number;
  packageType: string;
  customerName: string;
  customerPhone: string;
  guestsCount: number | null;
  price: number | null;
  notes: string | null;
  startTime: string; // ISO
  endTime: string; // ISO
  status: string;
  createdByName: string | null;
  createdAt: string; // ISO
}
