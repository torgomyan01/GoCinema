'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isStaffRole } from '@/lib/roles';
import {
  clearProductUnitsPekReported,
  markProductUnitsPekReported,
} from '@/lib/product-units';

export type FiscalOperation = 'sale' | 'return';
export type FiscalSource = 'box_office' | 'scanner';
export type FiscalPaymentMethod = 'cash' | 'card';

/** ՀԴՄ-ից ստացված ֆիսկալ պատասխանի ամբողջական տեսքը */
export interface HdmFiscalPayload {
  rseq?: number;
  fiscal?: string;
  crn?: string;
  sn?: string;
  tin?: string;
  taxpayer?: string;
  address?: string;
  time?: number;
  lottery?: string;
  prize?: number;
  total?: number;
  change?: number;
  emarksCount?: string | number;
  verificationNumber?: string | number;
  qr?: string;
}

export interface RecordFiscalReceiptInput {
  operation: FiscalOperation;
  source: FiscalSource;
  paymentMethod: FiscalPaymentMethod;
  status: 'printed' | 'failed';
  ticketId?: number | null;
  orderId?: number | null;
  /** ՀԴՄ պատասխանը (status=printed դեպքում) */
  fiscal?: HdmFiscalPayload | null;
  /** Ձախողման դեպքում սխալի հաղորդագրություն և կոդ */
  error?: string | null;
  code?: number | null;
  /** agent-ին ուղարկված հարցումը՝ վերատպման համար */
  requestPayload?: unknown;
}

async function requireStaffUserId(): Promise<number | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isStaffRole(user.role)) return null;
  const id = Number(user.id);
  return Number.isFinite(id) ? id : null;
}

function toInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toFloat(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function collectEmarksFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const raw = (payload as { eMarks?: unknown }).eMarks;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => (typeof c === 'string' ? c.trim() : String(c ?? '').trim()))
    .filter(Boolean);
}

/**
 * ՀԴՄ հաջող վաճառքից հետո՝ վաճառված միավորները նշել որպես
 * ՊԵԿ ուղարկված (շրջանառությունից դուրս)։
 * Վերադարձի դեպքում՝ հանել ՊԵԿ նշումը։
 */
async function syncPekFromFiscal(params: {
  operation: FiscalOperation;
  status: 'printed' | 'failed';
  orderId?: number | null;
  ticketId?: number | null;
  requestPayload?: unknown;
}) {
  if (params.status !== 'printed') return;

  let orderId = params.orderId ?? null;
  if (!orderId && params.ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: { orderId: true },
    });
    orderId = ticket?.orderId ?? null;
  }

  const eMarks = collectEmarksFromPayload(params.requestPayload);
  if (!orderId && eMarks.length === 0) return;

  try {
    if (params.operation === 'sale') {
      const count = await markProductUnitsPekReported({
        orderId,
        eMarks,
      });
      if (count > 0) {
        revalidatePath('/admin/product-units');
        revalidatePath('/admin/products');
      }
    } else if (params.operation === 'return') {
      const count = await clearProductUnitsPekReported({
        orderId,
        eMarks,
      });
      if (count > 0) {
        revalidatePath('/admin/product-units');
        revalidatePath('/admin/products');
      }
    }
  } catch (error) {
    console.error('syncPekFromFiscal error:', error);
  }
}

/**
 * Պահում է ֆիսկալ գործարքը բազայում (հաջողված կամ ձախողված)։
 * Կանչվում է դրամարկղի/scanner-ի բրաուզերից՝ ՀԴՄ agent-ի պատասխանից հետո։
 */
export async function recordFiscalReceipt(input: RecordFiscalReceiptInput) {
  const cashierId = await requireStaffUserId();
  if (!cashierId) {
    return { success: false as const, error: 'Մուտքն արգելված է' };
  }

  try {
    const f = input.fiscal ?? {};
    const fiscalTime =
      typeof f.time === 'number' && Number.isFinite(f.time)
        ? new Date(f.time)
        : null;

    const created = await prisma.fiscalReceipt.create({
      data: {
        operation: input.operation,
        source: input.source,
        paymentMethod: input.paymentMethod,
        status: input.status,
        errorMessage: input.status === 'failed' ? toStr(input.error) : null,
        errorCode: input.status === 'failed' ? toInt(input.code) : null,

        rseq: toInt(f.rseq),
        fiscalNumber: toStr(f.fiscal),
        crn: toStr(f.crn),
        sn: toStr(f.sn),
        tin: toStr(f.tin),
        taxpayer: toStr(f.taxpayer),
        address: toStr(f.address),
        fiscalTime,
        lottery: toStr(f.lottery),
        prize: f.prize != null ? toFloat(f.prize) : null,
        total: toFloat(f.total),
        change: toFloat(f.change),
        qr: toStr(f.qr),
        emarksCount: toInt(f.emarksCount) ?? 0,
        verificationNumber: toStr(f.verificationNumber),

        requestPayload:
          (input.requestPayload as Prisma.InputJsonValue | undefined) ??
          undefined,

        ticketId: input.ticketId ?? null,
        orderId: input.orderId ?? null,
        cashierId,
      },
      select: { id: true, status: true, fiscalNumber: true },
    });

    await syncPekFromFiscal({
      operation: input.operation,
      status: input.status,
      orderId: input.orderId,
      ticketId: input.ticketId,
      requestPayload: input.requestPayload,
    });

    revalidatePath('/admin/fiscal');
    return { success: true as const, id: created.id };
  } catch (error) {
    console.error('recordFiscalReceipt error:', error);
    return {
      success: false as const,
      error: 'Ֆիսկալ գործարքը բազայում պահելիս սխալ է տեղի ունեցել',
    };
  }
}

export interface FiscalReceiptListItem {
  id: number;
  operation: string;
  source: string;
  paymentMethod: string;
  status: string;
  errorMessage: string | null;
  errorCode: number | null;
  rseq: number | null;
  fiscalNumber: string | null;
  crn: string | null;
  total: number;
  change: number;
  qr: string | null;
  verificationNumber: string | null;
  ticketId: number | null;
  orderId: number | null;
  cashierName: string | null;
  createdAt: string;
  fiscalTime: string | null;
  eMarks: string[];
}

/** Ֆիսկալ կտրոնների ցանկը՝ ադմին էջի համար */
export async function getFiscalReceipts(options?: {
  status?: 'printed' | 'failed' | 'all';
  limit?: number;
}) {
  const cashierId = await requireStaffUserId();
  if (!cashierId) {
    return { success: false as const, error: 'Մուտքն արգելված է' };
  }

  const status = options?.status ?? 'all';
  const take = Math.min(Math.max(options?.limit ?? 100, 1), 500);

  try {
    const rows = await prisma.fiscalReceipt.findMany({
      where: status === 'all' ? undefined : { status },
      orderBy: { createdAt: 'desc' },
      take,
      include: { cashier: { select: { name: true } } },
    });

    const items: FiscalReceiptListItem[] = rows.map((r) => {
      const payload = r.requestPayload as { eMarks?: unknown } | null;
      const eMarks = Array.isArray(payload?.eMarks)
        ? payload.eMarks
            .map((c) =>
              typeof c === 'string' ? c.trim() : String(c ?? '').trim()
            )
            .filter(Boolean)
        : [];
      return {
        id: r.id,
        operation: r.operation,
        source: r.source,
        paymentMethod: r.paymentMethod,
        status: r.status,
        errorMessage: r.errorMessage,
        errorCode: r.errorCode,
        rseq: r.rseq,
        fiscalNumber: r.fiscalNumber,
        crn: r.crn,
        total: r.total,
        change: r.change,
        qr: r.qr,
        verificationNumber: r.verificationNumber,
        ticketId: r.ticketId,
        orderId: r.orderId,
        cashierName: r.cashier?.name ?? null,
        createdAt: r.createdAt.toISOString(),
        fiscalTime: r.fiscalTime ? r.fiscalTime.toISOString() : null,
        eMarks,
      };
    });

    const failedCount = await prisma.fiscalReceipt.count({
      where: { status: 'failed' },
    });

    return { success: true as const, items, failedCount };
  } catch (error) {
    console.error('getFiscalReceipts error:', error);
    return { success: false as const, error: 'Ֆիսկալ ցանկը բեռնելիս սխալ' };
  }
}

/** Վերատպման համար՝ ձախողված կտրոնի սկզբնական հարցումը */
export async function getFiscalReceiptForReprint(id: number) {
  const cashierId = await requireStaffUserId();
  if (!cashierId) {
    return { success: false as const, error: 'Մուտքն արգելված է' };
  }

  try {
    const row = await prisma.fiscalReceipt.findUnique({
      where: { id },
      select: {
        id: true,
        operation: true,
        source: true,
        paymentMethod: true,
        status: true,
        ticketId: true,
        orderId: true,
        requestPayload: true,
      },
    });
    if (!row) {
      return { success: false as const, error: 'Կտրոնը չի գտնվել' };
    }
    if (row.status !== 'failed') {
      return { success: false as const, error: 'Կտրոնն արդեն տպված է' };
    }
    if (row.requestPayload == null) {
      return {
        success: false as const,
        error: 'Վերատպման տվյալները բացակայում են',
      };
    }
    return { success: true as const, receipt: row };
  } catch (error) {
    console.error('getFiscalReceiptForReprint error:', error);
    return { success: false as const, error: 'Սխալ' };
  }
}

/** Հաջողված վերատպումից հետո՝ թարմացնում է կտրոնը ՀԴՄ պատասխանով */
export async function applyFiscalReprintResult(
  id: number,
  fiscal: HdmFiscalPayload
) {
  const cashierId = await requireStaffUserId();
  if (!cashierId) {
    return { success: false as const, error: 'Մուտքն արգելված է' };
  }

  try {
    const existing = await prisma.fiscalReceipt.findUnique({
      where: { id },
      select: {
        id: true,
        operation: true,
        orderId: true,
        ticketId: true,
        requestPayload: true,
      },
    });
    if (!existing) {
      return { success: false as const, error: 'Կտրոնը չի գտնվել' };
    }

    const f = fiscal ?? {};
    const fiscalTime =
      typeof f.time === 'number' && Number.isFinite(f.time)
        ? new Date(f.time)
        : null;

    await prisma.fiscalReceipt.update({
      where: { id },
      data: {
        status: 'printed',
        errorMessage: null,
        errorCode: null,
        rseq: toInt(f.rseq),
        fiscalNumber: toStr(f.fiscal),
        crn: toStr(f.crn),
        sn: toStr(f.sn),
        tin: toStr(f.tin),
        taxpayer: toStr(f.taxpayer),
        address: toStr(f.address),
        fiscalTime,
        lottery: toStr(f.lottery),
        prize: f.prize != null ? toFloat(f.prize) : null,
        total: toFloat(f.total),
        change: toFloat(f.change),
        qr: toStr(f.qr),
        emarksCount: toInt(f.emarksCount) ?? 0,
        verificationNumber: toStr(f.verificationNumber),
        cashierId,
      },
    });

    await syncPekFromFiscal({
      operation: (existing.operation === 'return' ? 'return' : 'sale') as FiscalOperation,
      status: 'printed',
      orderId: existing.orderId,
      ticketId: existing.ticketId,
      requestPayload: existing.requestPayload,
    });

    revalidatePath('/admin/fiscal');
    return { success: true as const };
  } catch (error) {
    console.error('applyFiscalReprintResult error:', error);
    return { success: false as const, error: 'Թարմացումը ձախողվեց' };
  }
}

/**
 * Գտնում է պատվերի/տոմսի սկզբնական վաճառքի ֆիսկալ կտրոնը՝ վերադարձի համար
 * (crn + rseq → HDM return receipt-ի հղում)։
 */
export async function findOriginalSaleReceipt(params: {
  orderId?: number | null;
  ticketId?: number | null;
}) {
  const cashierId = await requireStaffUserId();
  if (!cashierId) {
    return { success: false as const, error: 'Մուտքն արգելված է' };
  }

  const or: Prisma.FiscalReceiptWhereInput[] = [];
  if (params.orderId) or.push({ orderId: params.orderId });
  if (params.ticketId) or.push({ ticketId: params.ticketId });
  if (or.length === 0) {
    return { success: false as const, error: 'Բացակայում է հղումը' };
  }

  try {
    const row = await prisma.fiscalReceipt.findFirst({
      where: {
        operation: 'sale',
        status: 'printed',
        crn: { not: null },
        rseq: { not: null },
        OR: or,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, crn: true, rseq: true, total: true, paymentMethod: true },
    });
    if (!row) {
      return { success: false as const, error: 'Սկզբնական ֆիսկալ կտրոնը չի գտնվել' };
    }
    return { success: true as const, receipt: row };
  } catch (error) {
    console.error('findOriginalSaleReceipt error:', error);
    return { success: false as const, error: 'Սխալ' };
  }
}

/**
 * Ջնջում է ֆիսկալ կտրոնների գրառումները միայն տվյալների բազայից։
 * ՀԴՄ-ում արդեն տպված կտրոնը չի չեղարկվում։
 */
export async function deleteFiscalReceipts(ids: number[]) {
  const cashierId = await requireStaffUserId();
  if (!cashierId) {
    return { success: false as const, error: 'Մուտքն արգելված է', deleted: 0 };
  }

  const uniqueIds = Array.from(
    new Set(
      ids
        .map((id) => Math.trunc(Number(id)))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  if (uniqueIds.length === 0) {
    return { success: false as const, error: 'Ընտրված կտրոն չկա', deleted: 0 };
  }

  try {
    const result = await prisma.fiscalReceipt.deleteMany({
      where: { id: { in: uniqueIds } },
    });
    revalidatePath('/admin/fiscal');
    revalidatePath('/admin/accounting');
    return { success: true as const, deleted: result.count };
  } catch (error) {
    console.error('deleteFiscalReceipts error:', error);
    return { success: false as const, error: 'Ջնջումը ձախողվեց', deleted: 0 };
  }
}
