import { GOCINEMA_LEGAL } from '@/lib/gocinema-legal';

export type LicenseContractStatus = 'pending' | 'agreed' | 'signed';

export type LicenseContractParty = {
  name: string;
  tin: string;
  bankName: string | null;
  bankAccount: string | null;
  address: string | null;
  director: string | null;
  email: string | null;
};

export type LicenseContractContent = {
  number: string;
  contractDate: Date | string;
  premiereDate: Date | string;
  movieTitle: string;
  productionCountry: string;
  language: string;
  durationMinutes: number;
  ageRating: string | null;
  royaltyPercent: number;
  company: LicenseContractParty;
};

export function formatContractDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}թ.`;
}

export function formatDurationHy(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours} ժամ ${mins} րոպե`;
  if (hours) return `${hours} ժամ`;
  return `${mins} րոպե`;
}

export function armenianGenitive(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (/[իու]$/u.test(trimmed)) return trimmed;
  return `${trimmed}ի`;
}

export function companyLegalPhrase(name: string): string {
  const trimmed = name.trim();
  if (/ՍՊԸ/u.test(trimmed)) {
    const without = trimmed.replace(/\s*ՍՊԸ\s*/gu, ' ').replace(/\s+/g, ' ').trim();
    return `${without} սահմանափակ պատասխանատվությամբ ընկերությունը`;
  }
  if (/ԱՁ/u.test(trimmed)) {
    return `${trimmed}-ն`;
  }
  return `${trimmed}-ն`;
}

export function contractStatusLabel(status: string): string {
  if (status === 'signed') return 'Ստորագրված ֆայլ կա';
  if (status === 'agreed') return 'Համաձայն է';
  return 'Սպասում է հաստատման';
}

export { GOCINEMA_LEGAL };
