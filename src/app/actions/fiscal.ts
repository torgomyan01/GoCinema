'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isStaffRole } from '@/lib/roles';
import type { Prisma } from '@prisma/client';

const PAID_TICKET_STATUSES = ['paid', 'used'];

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isStaffRole(user.role)) {
    return null;
  }
  return user;
}

export type FiscalFilter = 'all' | 'pending' | 'issued';

interface GetFiscalTicketsParams {
  filter?: FiscalFilter;
  method?: string; // 'all' | 'cash' | 'card' | ...
  search?: string;
}

/** Բոլոր վաճառված (վճարված) տոմսերը՝ ՀԴՄ կարգավիճակով */
export async function getFiscalTickets(params: GetFiscalTicketsParams = {}) {
  const staff = await requireStaff();
  if (!staff) {
    return {
      success: false,
      error: 'Մուտքն արգելված է',
      tickets: [],
      summary: { total: 0, issued: 0, pending: 0, pendingAmount: 0 },
    };
  }

  try {
    const filter = params.filter ?? 'all';
    const method = params.method && params.method !== 'all' ? params.method : null;
    const search = params.search?.trim() || null;

    const where: Prisma.PaymentWhereInput = {
      status: 'completed',
      ticket: { status: { in: PAID_TICKET_STATUSES } },
    };

    if (filter === 'issued') where.fiscalReceiptIssued = true;
    if (filter === 'pending') where.fiscalReceiptIssued = false;
    if (method) where.method = method;

    if (search) {
      const asNumber = Number(search.replace(/\D/g, ''));
      const orConditions: Prisma.PaymentWhereInput[] = [
        { user: { phone: { contains: search } } },
        { user: { name: { contains: search } } },
        { ticket: { screening: { movie: { title: { contains: search } } } } },
      ];
      if (Number.isFinite(asNumber) && asNumber > 0) {
        orConditions.push({ ticketId: asNumber });
        orConditions.push({ id: asNumber });
      }
      where.OR = orConditions;
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        user: { select: { name: true, phone: true } },
        ticket: {
          include: {
            seat: { select: { row: true, number: true, seatType: true } },
            screening: {
              include: {
                movie: { select: { title: true } },
                hall: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const tickets = payments.map((p) => ({
      paymentId: p.id,
      ticketId: p.ticketId,
      amount: p.amount,
      method: p.method,
      transactionId: p.transactionId,
      createdAt: p.createdAt,
      fiscalReceiptIssued: p.fiscalReceiptIssued,
      fiscalReceiptNumber: p.fiscalReceiptNumber,
      fiscalReceiptAt: p.fiscalReceiptAt,
      customerName: p.user?.name ?? null,
      customerPhone: p.user?.phone ?? null,
      ticketStatus: p.ticket.status,
      seat: p.ticket.seat
        ? { row: p.ticket.seat.row, number: p.ticket.seat.number, seatType: p.ticket.seat.seatType }
        : null,
      movieTitle: p.ticket.screening?.movie?.title ?? null,
      hallName: p.ticket.screening?.hall?.name ?? null,
      startTime: p.ticket.screening?.startTime ?? null,
    }));

    // Ամփոփ վիճակագրությունը հաշվում ենք ֆիլտրից անկախ
    const [total, issued, pendingAgg] = await Promise.all([
      prisma.payment.count({
        where: { status: 'completed', ticket: { status: { in: PAID_TICKET_STATUSES } } },
      }),
      prisma.payment.count({
        where: {
          status: 'completed',
          fiscalReceiptIssued: true,
          ticket: { status: { in: PAID_TICKET_STATUSES } },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'completed',
          fiscalReceiptIssued: false,
          ticket: { status: { in: PAID_TICKET_STATUSES } },
        },
      }),
    ]);

    return {
      success: true,
      tickets,
      summary: {
        total,
        issued,
        pending: total - issued,
        pendingAmount: pendingAgg._sum.amount ?? 0,
      },
    };
  } catch (error) {
    console.error('[Get Fiscal Tickets] Error:', error);
    return {
      success: false,
      error: 'Տոմսերը բեռնելիս սխալ է տեղի ունեցել',
      tickets: [],
      summary: { total: 0, issued: 0, pending: 0, pendingAmount: 0 },
    };
  }
}

/** Հաստատել, որ ՀԴՄ չեկը հանված է (հարկը վճարված է) */
export async function markFiscalReceiptIssued(
  paymentId: number,
  receiptNumber?: string
) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, fiscalReceiptIssued: true },
    });
    if (!payment) {
      return { success: false, error: 'Վճարումը չի գտնվել' };
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        fiscalReceiptIssued: true,
        fiscalReceiptAt: new Date(),
        fiscalReceiptNumber: receiptNumber?.trim() || null,
        fiscalizedBy: Number(staff.id),
      },
    });

    revalidatePath('/admin/fiscal');
    return { success: true };
  } catch (error) {
    console.error('[Mark Fiscal Receipt] Error:', error);
    return { success: false, error: 'Հաստատելիս սխալ է տեղի ունեցել' };
  }
}

/** Հետ բերել ՀԴՄ հաստատումը (սխալի դեպքում) */
export async function unmarkFiscalReceipt(paymentId: number) {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        fiscalReceiptIssued: false,
        fiscalReceiptAt: null,
        fiscalReceiptNumber: null,
        fiscalizedBy: null,
      },
    });

    revalidatePath('/admin/fiscal');
    return { success: true };
  } catch (error) {
    console.error('[Unmark Fiscal Receipt] Error:', error);
    return { success: false, error: 'Փոփոխելիս սխալ է տեղի ունեցել' };
  }
}
