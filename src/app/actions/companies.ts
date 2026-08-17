'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminRole } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type CompanySocial = {
  network: string;
  url: string;
};

export type CompanyView = {
  id: number;
  name: string;
  tin: string;
  bankName: string | null;
  bankAccount: string | null;
  address: string | null;
  director: string | null;
  email: string | null;
  website: string | null;
  phones: string[];
  socials: CompanySocial[];
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CompanyInput = {
  name: string;
  tin: string;
  bankName?: string;
  bankAccount?: string;
  address?: string;
  director?: string;
  email?: string;
  website?: string;
  phones?: string[];
  socials?: CompanySocial[];
  notes?: string;
  isActive?: boolean;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  return Boolean(user?.id && isAdminRole(user.role));
}

function parseJsonList(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function toView(row: {
  id: number;
  name: string;
  tin: string;
  bankName: string | null;
  bankAccount: string | null;
  address: string | null;
  director: string | null;
  email: string | null;
  website: string | null;
  phones: string;
  socials: string;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CompanyView {
  const phones = parseJsonList(row.phones)
    .map((item) => String(item).trim())
    .filter(Boolean);
  const socials = parseJsonList(row.socials)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rowItem = item as { network?: unknown; url?: unknown };
      const network = String(rowItem.network || '').trim();
      const url = String(rowItem.url || '').trim();
      if (!network && !url) return null;
      return { network: network || 'Այլ', url };
    })
    .filter((item): item is CompanySocial => Boolean(item));

  return {
    ...row,
    phones,
    socials,
  };
}

function cleanInput(data: CompanyInput) {
  const name = data.name.trim();
  const tin = data.tin.replace(/\s+/g, '').trim();
  if (!name) return { error: 'Ընկերության անունը պարտադիր է' };
  if (!tin) return { error: 'ՀՎՀՀ-ն պարտադիր է' };

  const phones = (data.phones || []).map((item) => item.trim()).filter(Boolean);
  const socials = (data.socials || [])
    .map((item) => ({
      network: item.network.trim(),
      url: item.url.trim(),
    }))
    .filter((item) => item.network || item.url);

  return {
    payload: {
      name,
      tin,
      bankName: data.bankName?.trim() || null,
      bankAccount: data.bankAccount?.replace(/\s+/g, '') || null,
      address: data.address?.trim() || null,
      director: data.director?.trim() || null,
      email: data.email?.trim() || null,
      website: data.website?.trim() || null,
      phones: JSON.stringify(phones),
      socials: JSON.stringify(socials),
      notes: data.notes?.trim() || null,
      isActive: data.isActive ?? true,
    },
  };
}

export async function getCompanies(): Promise<{
  success: boolean;
  error?: string;
  companies: CompanyView[];
}> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է', companies: [] };
  }
  try {
    const rows = await prisma.company.findMany({
      orderBy: { name: 'asc' },
    });
    return { success: true, companies: rows.map(toView) };
  } catch (error) {
    console.error('[getCompanies]', error);
    return {
      success: false,
      error: 'Ընկերությունները բեռնելիս սխալ է տեղի ունեցել',
      companies: [],
    };
  }
}

export async function createCompany(data: CompanyInput): Promise<{
  success: boolean;
  error?: string;
  company?: CompanyView;
}> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }
  const cleaned = cleanInput(data);
  if ('error' in cleaned && cleaned.error) {
    return { success: false, error: cleaned.error };
  }
  try {
    const row = await prisma.company.create({ data: cleaned.payload! });
    revalidatePath('/admin/companies');
    return { success: true, company: toView(row) };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2002') {
      return { success: false, error: 'Այս ՀՎՀՀ-ով ընկերություն արդեն կա' };
    }
    console.error('[createCompany]', error);
    return { success: false, error: 'Չհաջողվեց պահպանել' };
  }
}

export async function updateCompany(
  id: number,
  data: CompanyInput
): Promise<{
  success: boolean;
  error?: string;
  company?: CompanyView;
}> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }
  const cleaned = cleanInput(data);
  if ('error' in cleaned && cleaned.error) {
    return { success: false, error: cleaned.error };
  }
  try {
    const row = await prisma.company.update({
      where: { id },
      data: cleaned.payload!,
    });
    revalidatePath('/admin/companies');
    return { success: true, company: toView(row) };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2002') {
      return { success: false, error: 'Այս ՀՎՀՀ-ով ընկերություն արդեն կա' };
    }
    console.error('[updateCompany]', error);
    return { success: false, error: 'Չհաջողվեց թարմացնել' };
  }
}

export async function deleteCompany(id: number): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }
  try {
    await prisma.company.delete({ where: { id } });
    revalidatePath('/admin/companies');
    return { success: true };
  } catch (error) {
    console.error('[deleteCompany]', error);
    return { success: false, error: 'Չհաջողվեց ջնջել' };
  }
}
