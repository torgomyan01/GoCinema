'use server';

import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminRole } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import type { LicenseContractContent } from '@/lib/license-contract';

export type LicenseContractView = {
  id: number;
  publicToken: string;
  number: string;
  movieId: number;
  companyId: number;
  movieTitle: string;
  durationMinutes: number;
  ageRating: string | null;
  productionCountry: string;
  language: string;
  royaltyPercent: number;
  contractDate: Date;
  premiereDate: Date;
  companyName: string;
  companyTin: string;
  companyBankName: string | null;
  companyBankAccount: string | null;
  companyAddress: string | null;
  companyDirector: string | null;
  companyEmail: string | null;
  status: string;
  agreedAt: Date | null;
  signedUrl: string | null;
  signedName: string | null;
  signedAt: Date | null;
  bodyHtml: string | null;
  createdAt: Date;
  movie: { id: number; title: string };
  company: { id: number; name: string; tin: string };
};

export type LicenseContractInput = {
  movieId: number;
  companyId: number;
  contractDate: string;
  premiereDate: string;
  productionCountry: string;
  language: string;
  royaltyPercent: number;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  return Boolean(user?.id && isAdminRole(user.role));
}

function toContent(row: {
  number: string;
  contractDate: Date;
  premiereDate: Date;
  movieTitle: string;
  productionCountry: string;
  language: string;
  durationMinutes: number;
  ageRating: string | null;
  royaltyPercent: number;
  companyName: string;
  companyTin: string;
  companyBankName: string | null;
  companyBankAccount: string | null;
  companyAddress: string | null;
  companyDirector: string | null;
  companyEmail: string | null;
}): LicenseContractContent {
  return {
    number: row.number,
    contractDate: row.contractDate,
    premiereDate: row.premiereDate,
    movieTitle: row.movieTitle,
    productionCountry: row.productionCountry,
    language: row.language,
    durationMinutes: row.durationMinutes,
    ageRating: row.ageRating,
    royaltyPercent: row.royaltyPercent,
    company: {
      name: row.companyName,
      tin: row.companyTin,
      bankName: row.companyBankName,
      bankAccount: row.companyBankAccount,
      address: row.companyAddress,
      director: row.companyDirector,
      email: row.companyEmail,
    },
  };
}

async function nextContractNumber() {
  const year = new Date().getFullYear();
  const prefix = `GC-LIC-${year}-`;
  const last = await prisma.licenseContract.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const seq = last ? parseInt(last.number.slice(prefix.length), 10) + 1 : 1;
  const safeSeq = Number.isFinite(seq) && seq > 0 ? seq : 1;
  return `${prefix}${String(safeSeq).padStart(3, '0')}`;
}

function parseDateOnly(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function getLicenseContractOptions() {
  if (!(await requireAdmin())) {
    return {
      success: false,
      error: 'Մուտքն արգելված է',
      companies: [],
      movies: [],
    };
  }

  const [companies, movies] = await Promise.all([
    prisma.company.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        tin: true,
        bankName: true,
        bankAccount: true,
        address: true,
        director: true,
        email: true,
        isActive: true,
      },
    }),
    prisma.movie.findMany({
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        duration: true,
        ageRating: true,
        releaseDate: true,
        licenseContract: { select: { id: true } },
      },
    }),
  ]);

  return {
    success: true,
    companies,
    movies: movies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      duration: movie.duration,
      ageRating: movie.ageRating,
      releaseDate: movie.releaseDate,
      hasContract: Boolean(movie.licenseContract),
    })),
  };
}

export async function getLicenseContracts(): Promise<{
  success: boolean;
  error?: string;
  contracts: LicenseContractView[];
}> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է', contracts: [] };
  }

  try {
    const contracts = await prisma.licenseContract.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        movie: { select: { id: true, title: true } },
        company: { select: { id: true, name: true, tin: true } },
      },
    });
    return { success: true, contracts };
  } catch (error) {
    console.error('[getLicenseContracts]', error);
    return {
      success: false,
      error: 'Պայմանագրերը բեռնելիս սխալ է տեղի ունեցել',
      contracts: [],
    };
  }
}

export async function createLicenseContract(data: LicenseContractInput): Promise<{
  success: boolean;
  error?: string;
  contract?: LicenseContractView;
}> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const contractDate = parseDateOnly(data.contractDate);
  const premiereDate = parseDateOnly(data.premiereDate);
  const royalty = Math.round(Number(data.royaltyPercent));
  if (!data.movieId || !data.companyId) {
    return { success: false, error: 'Ընտրիր ֆիլմը և ընկերությունը' };
  }
  if (!contractDate || !premiereDate) {
    return { success: false, error: 'Ամսաթվերը պարտադիր են' };
  }
  if (!Number.isFinite(royalty) || royalty < 1 || royalty > 100) {
    return { success: false, error: 'Ռոյալթին պետք է լինի 1-ից 100%' };
  }

  const [movie, company, existing] = await Promise.all([
    prisma.movie.findUnique({ where: { id: data.movieId } }),
    prisma.company.findUnique({ where: { id: data.companyId } }),
    prisma.licenseContract.findUnique({ where: { movieId: data.movieId } }),
  ]);

  if (!movie) return { success: false, error: 'Ֆիլմը չի գտնվել' };
  if (!company) return { success: false, error: 'Ընկերությունը չի գտնվել' };
  if (existing) {
    return {
      success: false,
      error: 'Այս ֆիլմի համար պայմանագիր արդեն կա',
    };
  }
  if (!company.director || !company.address || !company.email || !company.bankName || !company.bankAccount) {
    return {
      success: false,
      error: 'Ընկերության ռեկվիզիտները թերի են։ Լրացրու տնօրեն, հասցե, email, բանկ և Հ/Հ։',
    };
  }

  try {
    const contract = await prisma.licenseContract.create({
      data: {
        publicToken: randomBytes(24).toString('hex'),
        number: await nextContractNumber(),
        movieId: movie.id,
        companyId: company.id,
        movieTitle: movie.title,
        durationMinutes: movie.duration,
        ageRating: movie.ageRating,
        productionCountry: data.productionCountry.trim() || 'Հայաստանի Հանրապետություն',
        language: data.language.trim() || 'Հայերեն',
        royaltyPercent: royalty,
        contractDate,
        premiereDate,
        companyName: company.name,
        companyTin: company.tin,
        companyBankName: company.bankName,
        companyBankAccount: company.bankAccount,
        companyAddress: company.address,
        companyDirector: company.director,
        companyEmail: company.email,
      },
      include: {
        movie: { select: { id: true, title: true } },
        company: { select: { id: true, name: true, tin: true } },
      },
    });

    revalidatePath('/admin/contracts');
    return { success: true, contract };
  } catch (error) {
    console.error('[createLicenseContract]', error);
    return { success: false, error: 'Չհաջողվեց ստեղծել պայմանագիրը' };
  }
}

export async function attachSignedLicenseContract(
  id: number,
  signedUrl: string,
  signedName: string
): Promise<{ success: boolean; error?: string; contract?: LicenseContractView }> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }
  if (!signedUrl) {
    return { success: false, error: 'Ֆայլը պարտադիր է' };
  }

  try {
    const contract = await prisma.licenseContract.update({
      where: { id },
      data: {
        signedUrl,
        signedName: signedName || 'signed.pdf',
        signedAt: new Date(),
        status: 'signed',
      },
      include: {
        movie: { select: { id: true, title: true } },
        company: { select: { id: true, name: true, tin: true } },
      },
    });
    revalidatePath('/admin/contracts');
    return { success: true, contract };
  } catch (error) {
    console.error('[attachSignedLicenseContract]', error);
    return { success: false, error: 'Չհաջողվեց կցել ֆայլը' };
  }
}

function sanitizeContractHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son[a-z]+="[^"]*"/gi, '')
    .replace(/\son[a-z]+='[^']*'/gi, '')
    .replace(/\son[a-z]+=\S+/gi, '');
}

export async function updateLicenseContractBody(
  id: number,
  bodyHtml: string
): Promise<{ success: boolean; error?: string; contract?: LicenseContractView }> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const html = sanitizeContractHtml(bodyHtml).trim();
  if (!html) {
    return { success: false, error: 'Տեքստը դատարկ է' };
  }
  if (html.length > 500_000) {
    return { success: false, error: 'Տեքստը չափից երկար է' };
  }

  try {
    const contract = await prisma.licenseContract.update({
      where: { id },
      data: { bodyHtml: html },
      include: {
        movie: { select: { id: true, title: true } },
        company: { select: { id: true, name: true, tin: true } },
      },
    });
    revalidatePath('/admin/contracts');
    revalidatePath(`/contract/${contract.publicToken}`);
    return { success: true, contract };
  } catch (error) {
    console.error('[updateLicenseContractBody]', error);
    return { success: false, error: 'Չհաջողվեց պահպանել տեքստը' };
  }
}

export async function deleteLicenseContract(
  id: number
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const existing = await prisma.licenseContract.findUnique({
      where: { id },
      select: { publicToken: true },
    });
    if (!existing) {
      return { success: false, error: 'Պայմանագիրը չի գտնվել' };
    }

    await prisma.licenseContract.delete({ where: { id } });
    revalidatePath('/admin/contracts');
    revalidatePath(`/contract/${existing.publicToken}`);
    return { success: true };
  } catch (error) {
    console.error('[deleteLicenseContract]', error);
    return { success: false, error: 'Չհաջողվեց ջնջել պայմանագիրը' };
  }
}

export async function getPublicLicenseContract(token: string): Promise<{
  success: boolean;
  error?: string;
  contract?: {
    number: string;
    status: string;
    agreedAt: Date | null;
    signedUrl: string | null;
    signedName: string | null;
    content: LicenseContractContent;
    bodyHtml: string | null;
  };
}> {
  const value = token.trim();
  if (!value) {
    return { success: false, error: 'Պայմանագիրը չի գտնվել' };
  }

  const row = await prisma.licenseContract.findUnique({
    where: { publicToken: value },
  });
  if (!row) {
    return { success: false, error: 'Պայմանագիրը չի գտնվել' };
  }

  return {
    success: true,
    contract: {
      number: row.number,
      status: row.status,
      agreedAt: row.agreedAt,
      signedUrl: row.signedUrl,
      signedName: row.signedName,
      content: toContent(row),
      bodyHtml: row.bodyHtml,
    },
  };
}

export async function agreeToLicenseContract(token: string): Promise<{
  success: boolean;
  error?: string;
  agreedAt?: Date;
}> {
  const row = await prisma.licenseContract.findUnique({
    where: { publicToken: token.trim() },
    select: { id: true, agreedAt: true, status: true },
  });
  if (!row) {
    return { success: false, error: 'Պայմանագիրը չի գտնվել' };
  }
  if (row.agreedAt) {
    return { success: true, agreedAt: row.agreedAt };
  }

  const headerList = await headers();
  const ip =
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerList.get('x-real-ip') ||
    null;
  const userAgent = headerList.get('user-agent')?.slice(0, 500) || null;

  const updated = await prisma.licenseContract.update({
    where: { id: row.id },
    data: {
      agreedAt: new Date(),
      agreedIp: ip,
      agreedUserAgent: userAgent,
      status: row.status === 'signed' ? 'signed' : 'agreed',
    },
    select: { agreedAt: true },
  });

  revalidatePath('/admin/contracts');
  return { success: true, agreedAt: updated.agreedAt ?? undefined };
}

export async function uploadSignedLicenseByToken(
  token: string,
  formData: FormData
): Promise<{
  success: boolean;
  error?: string;
  signedUrl?: string;
  signedName?: string;
}> {
  const row = await prisma.licenseContract.findUnique({
    where: { publicToken: token.trim() },
    select: { id: true, agreedAt: true },
  });
  if (!row) {
    return { success: false, error: 'Պայմանագիրը չի գտնվել' };
  }
  if (!row.agreedAt) {
    return {
      success: false,
      error: 'Նախ հաստատիր պայմանները, ապա կցիր ստորագրված ֆայլը',
    };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Ֆայլը չի ներբեռնվել' };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { success: false, error: 'Ֆայլի չափը չպետք է գերազանցի 15MB' };
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
  if (!allowed.includes(ext)) {
    return { success: false, error: 'Թույլատրվում են PDF և նկար ֆայլեր' };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }
  const filename = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
  await writeFile(join(uploadDir, filename), bytes);

  const signedUrl = `/api/files/${filename}`;
  const signedName = file.name || filename;

  await prisma.licenseContract.update({
    where: { id: row.id },
    data: {
      signedUrl,
      signedName,
      signedAt: new Date(),
      status: 'signed',
    },
  });

  revalidatePath('/admin/contracts');
  return { success: true, signedUrl, signedName };
}
