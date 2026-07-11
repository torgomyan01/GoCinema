'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import {
  normalizeExpenseCategory,
  type ExpenseAnalytics,
  type ExpenseCategoryPoint,
  type ExpenseDailyPoint,
  type ExpensePersonPoint,
  type ExpenseRow,
  type ExpensesResult,
  type ExpenseWeeklyPoint,
} from '@/lib/expenses';
import { prisma } from '@/lib/prisma';
import { isAdminRole } from '@/lib/roles';

export type {
  ExpenseAnalytics,
  ExpenseCategoryPoint,
  ExpenseDailyPoint,
  ExpensePersonPoint,
  ExpenseRow,
  ExpensesResult,
  ExpenseWeeklyPoint,
} from '@/lib/expenses';

function localDateKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekStart(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const dayFromMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayFromMonday);
  return date;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !isAdminRole(user.role)) {
    return null;
  }
  return user;
}

function normalizeCategory(value: unknown) {
  return normalizeExpenseCategory(value);
}

function parseDateOnly(value: string, endOfDay = false): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

export async function getExpenses(params: {
  from: string;
  to: string;
  category?: string;
  spentBy?: string;
}): Promise<{ success: boolean; error: string | null; data: ExpensesResult | null }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  try {
    const from = parseDateOnly(params.from);
    const to = parseDateOnly(params.to, true);
    if (!from || !to) {
      return { success: false, error: 'Սխալ ամսաթիվ', data: null };
    }

    const where: {
      expenseDate: { gte: Date; lte: Date };
      category?: string;
      spentBy?: { contains: string };
    } = {
      expenseDate: { gte: from, lte: to },
    };

    if (params.category && params.category !== 'all') {
      where.category = normalizeCategory(params.category);
    }
    if (params.spentBy && params.spentBy.trim()) {
      where.spentBy = { contains: params.spentBy.trim() };
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
    });

    const rows: ExpenseRow[] = expenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      category: e.category,
      spentBy: e.spentBy,
      note: e.note,
      expenseDate: e.expenseDate.toISOString(),
      createdByName: e.createdBy?.name ?? null,
      createdAt: e.createdAt.toISOString(),
    }));

    // Analytics
    const dailyMap = new Map<string, ExpenseDailyPoint>();
    const weeklyMap = new Map<string, ExpenseWeeklyPoint>();
    const categoryMap = new Map<string, ExpenseCategoryPoint>();
    const personMap = new Map<string, ExpensePersonPoint>();
    let total = 0;

    for (const e of expenses) {
      total += e.amount;

      const dKey = localDateKey(e.expenseDate);
      const dPoint = dailyMap.get(dKey) ?? { dateKey: dKey, total: 0, count: 0 };
      dPoint.total += e.amount;
      dPoint.count += 1;
      dailyMap.set(dKey, dPoint);

      const wKey = localDateKey(getWeekStart(e.expenseDate));
      const wPoint = weeklyMap.get(wKey) ?? {
        weekStart: wKey,
        total: 0,
        count: 0,
      };
      wPoint.total += e.amount;
      wPoint.count += 1;
      weeklyMap.set(wKey, wPoint);

      const cPoint = categoryMap.get(e.category) ?? {
        category: e.category,
        total: 0,
        count: 0,
      };
      cPoint.total += e.amount;
      cPoint.count += 1;
      categoryMap.set(e.category, cPoint);

      const personKey = e.spentBy.trim() || '—';
      const pPoint = personMap.get(personKey) ?? {
        spentBy: personKey,
        total: 0,
        count: 0,
      };
      pPoint.total += e.amount;
      pPoint.count += 1;
      personMap.set(personKey, pPoint);
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey)
    );
    const weekly = Array.from(weeklyMap.values()).sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart)
    );
    const byCategory = Array.from(categoryMap.values()).sort(
      (a, b) => b.total - a.total
    );
    const byPerson = Array.from(personMap.values()).sort(
      (a, b) => b.total - a.total
    );

    const daysCount = daily.length;
    const averagePerDay = daysCount > 0 ? total / daysCount : 0;

    return {
      success: true,
      error: null,
      data: {
        rows,
        analytics: {
          total,
          count: expenses.length,
          averagePerDay,
          daysCount,
          daily,
          weekly,
          byCategory,
          byPerson,
        },
      },
    };
  } catch (error) {
    console.error('[Get Expenses] Error:', error);
    return {
      success: false,
      error: 'Ծախսերը բեռնելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}

export async function createExpense(input: {
  title: string;
  amount: number;
  category: string;
  spentBy: string;
  note?: string;
  expenseDate: string;
}): Promise<{ success: boolean; error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const title = String(input.title ?? '').trim();
    const spentBy = String(input.spentBy ?? '').trim();
    const amount = Number(input.amount);
    const date = parseDateOnly(input.expenseDate);

    if (!title) {
      return { success: false, error: 'Նշեք ծախսի անվանումը' };
    }
    if (!spentBy) {
      return { success: false, error: 'Նշեք ծախս վերցնողի անունը' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'Նշեք վավեր գումար' };
    }
    if (!date) {
      return { success: false, error: 'Նշեք վավեր ամսաթիվ' };
    }

    await prisma.expense.create({
      data: {
        title,
        amount,
        category: normalizeCategory(input.category),
        spentBy,
        note: input.note?.trim() || null,
        expenseDate: date,
        createdById: admin.id ? Number(admin.id) : null,
      },
    });

    revalidatePath('/admin/expenses');
    return { success: true, error: null };
  } catch (error) {
    console.error('[Create Expense] Error:', error);
    return { success: false, error: 'Ծախսը ավելացնելիս սխալ է տեղի ունեցել' };
  }
}

export async function updateExpense(input: {
  id: number;
  title: string;
  amount: number;
  category: string;
  spentBy: string;
  note?: string;
  expenseDate: string;
}): Promise<{ success: boolean; error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const id = Number(input.id);
    const title = String(input.title ?? '').trim();
    const spentBy = String(input.spentBy ?? '').trim();
    const amount = Number(input.amount);
    const date = parseDateOnly(input.expenseDate);

    if (!Number.isFinite(id)) {
      return { success: false, error: 'Սխալ ID' };
    }
    if (!title) {
      return { success: false, error: 'Նշեք ծախսի անվանումը' };
    }
    if (!spentBy) {
      return { success: false, error: 'Նշեք ծախս վերցնողի անունը' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'Նշեք վավեր գումար' };
    }
    if (!date) {
      return { success: false, error: 'Նշեք վավեր ամսաթիվ' };
    }

    await prisma.expense.update({
      where: { id },
      data: {
        title,
        amount,
        category: normalizeCategory(input.category),
        spentBy,
        note: input.note?.trim() || null,
        expenseDate: date,
      },
    });

    revalidatePath('/admin/expenses');
    return { success: true, error: null };
  } catch (error) {
    console.error('[Update Expense] Error:', error);
    return { success: false, error: 'Ծախսը թարմացնելիս սխալ է տեղի ունեցել' };
  }
}

export async function deleteExpense(
  id: number
): Promise<{ success: boolean; error: string | null }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  try {
    const expenseId = Number(id);
    if (!Number.isFinite(expenseId)) {
      return { success: false, error: 'Սխալ ID' };
    }

    await prisma.expense.delete({ where: { id: expenseId } });

    revalidatePath('/admin/expenses');
    return { success: true, error: null };
  } catch (error) {
    console.error('[Delete Expense] Error:', error);
    return { success: false, error: 'Ծախսը ջնջելիս սխալ է տեղի ունեցել' };
  }
}
