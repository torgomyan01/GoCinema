'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdminRole, isStaffRole } from '@/lib/roles';
import { validateBirthDate } from '@/lib/birth-date';
import {
  applyReferralCode,
  BONUS_TYPE_LABELS_HY,
  BonusSettingsValues,
  computeEarnedPoints,
  ensureReferralCode,
  getBonusSettings,
  grantBirthdayBonusIfDue,
  grantWelcomeBonus,
  recalculateBalance,
  recordBonusMovement,
  tierForVisits,
  tierMultiplier,
  WALK_IN_PHONE,
} from '@/lib/bonus';

// ─── Ընդհանուր օգնականներ ───────────────────────────────────────────────────

async function requireUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return null;
  const id = Number(user.id);
  if (!id || Number.isNaN(id)) return null;
  return { id, role: user.role };
}

async function requireStaff() {
  const user = await requireUser();
  if (!user || !isStaffRole(user.role)) return null;
  return user;
}

async function requireAdmin() {
  const user = await requireUser();
  if (!user || !isAdminRole(user.role)) return null;
  return user;
}

// ─── Օգտատերի կողմ ──────────────────────────────────────────────────────────

export interface BonusRewardItem {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  kind: string;
  productId: number | null;
  productName: string | null;
  discountAmount: number;
  affordable: boolean;
}

export interface BonusHistoryItem {
  id: number;
  type: string;
  typeLabel: string;
  points: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface MyBonusData {
  isActive: boolean;
  points: number;
  tier: string;
  visits: number;
  nextTier: string | null;
  visitsToNextTier: number;
  earnMultiplier: number;
  referralCode: string | null;
  referralCount: number;
  referralInviterPoints: number;
  referralInvitedPoints: number;
  amountPerPoint: number;
  bonusWeekdays: number[];
  bonusDayMultiplier: number;
  rewards: BonusRewardItem[];
  history: BonusHistoryItem[];
}

/** Հաշվի էջի բոնուսային բաժինը (միաժամանակ տալիս է ողջույնի/ծննդյան բոնուսը)։ */
export async function getMyBonus(): Promise<{
  success: boolean;
  error: string | null;
  data: MyBonusData | null;
}> {
  const sessionUser = await requireUser();
  if (!sessionUser) {
    return { success: false, error: 'Անհրաժեշտ է մուտք գործել', data: null };
  }

  try {
    const settings = await getBonusSettings();

    if (settings.isActive) {
      await grantWelcomeBonus(sessionUser.id);
      await grantBirthdayBonusIfDue(sessionUser.id);
      await ensureReferralCode(sessionUser.id);
    }

    const [user, rewards, history] = await Promise.all([
      prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: {
          bonusPoints: true,
          bonusTier: true,
          bonusVisits: true,
          referralCode: true,
          _count: { select: { referrals: true } },
        },
      }),
      prisma.bonusReward.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { pointsCost: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          pointsCost: true,
          kind: true,
          productId: true,
          discountAmount: true,
          product: { select: { name: true } },
        },
      }),
      prisma.bonusTransaction.findMany({
        where: { userId: sessionUser.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          type: true,
          points: true,
          balanceAfter: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    if (!user) {
      return { success: false, error: 'Օգտատերը չի գտնվել', data: null };
    }

    const nextTier =
      user.bonusTier === 'silver'
        ? 'gold'
        : user.bonusTier === 'gold'
          ? 'platinum'
          : null;
    const nextTierVisits =
      nextTier === 'gold'
        ? settings.goldVisits
        : nextTier === 'platinum'
          ? settings.platinumVisits
          : 0;

    return {
      success: true,
      error: null,
      data: {
        isActive: settings.isActive,
        points: user.bonusPoints,
        tier: user.bonusTier,
        visits: user.bonusVisits,
        nextTier,
        visitsToNextTier: Math.max(0, nextTierVisits - user.bonusVisits),
        earnMultiplier: tierMultiplier(user.bonusTier, settings),
        referralCode: user.referralCode,
        referralCount: user._count.referrals,
        referralInviterPoints: settings.referralInviterPoints,
        referralInvitedPoints: settings.referralInvitedPoints,
        amountPerPoint: settings.amountPerPoint,
        bonusWeekdays: settings.bonusWeekdays
          .split(',')
          .map((d) => Number(d.trim()))
          .filter((d) => Number.isInteger(d)),
        bonusDayMultiplier: settings.bonusDayMultiplier,
        rewards: rewards.map((reward) => ({
          id: reward.id,
          name: reward.name,
          description: reward.description,
          pointsCost: reward.pointsCost,
          kind: reward.kind,
          productId: reward.productId,
          productName: reward.product?.name ?? null,
          discountAmount: reward.discountAmount,
          affordable: user.bonusPoints >= reward.pointsCost,
        })),
        history: history.map((row) => ({
          id: row.id,
          type: row.type,
          typeLabel: BONUS_TYPE_LABELS_HY[row.type] ?? row.type,
          points: row.points,
          balanceAfter: row.balanceAfter,
          description: row.description,
          createdAt: row.createdAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    console.error('[Get My Bonus] Error:', error);
    return {
      success: false,
      error: 'Բոնուսային տվյալները բեռնելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}

/** Header-ի համար՝ միայն միավորներ + մակարդակ (առանց rewards/history)։ */
export async function getMyBonusSummary(): Promise<{
  success: boolean;
  points: number;
  tier: string;
  isActive: boolean;
} | null> {
  const sessionUser = await requireUser();
  if (!sessionUser) return null;

  try {
    const settings = await getBonusSettings();
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { bonusPoints: true, bonusTier: true },
    });
    if (!user) return null;

    return {
      success: true,
      points: user.bonusPoints,
      tier: user.bonusTier,
      isActive: settings.isActive,
    };
  } catch (error) {
    console.error('[Get My Bonus Summary] Error:', error);
    return null;
  }
}

/** Հրավերի կոդի կիրառում՝ արդեն գրանցված օգտատիրոջ կողմից։ */
export async function redeemReferralCode(code: string) {
  const sessionUser = await requireUser();
  if (!sessionUser) {
    return { success: false, error: 'Անհրաժեշտ է մուտք գործել' };
  }

  try {
    const result = await prisma.$transaction((tx) =>
      applyReferralCode(tx, sessionUser.id, code)
    );

    if (!result.ok) {
      return { success: false, error: result.error ?? 'Կոդը վավեր չէ' };
    }

    revalidatePath('/account');
    return {
      success: true,
      points: result.points,
      message: `Կոդն ընդունված է։ Ստացաք ${result.points} միավոր`,
    };
  } catch (error) {
    console.error('[Redeem Referral Code] Error:', error);
    return { success: false, error: 'Կոդը կիրառելիս սխալ է տեղի ունեցել' };
  }
}

// ─── Դրամարկղ ───────────────────────────────────────────────────────────────

export interface BonusCustomer {
  id: number;
  name: string | null;
  phone: string;
  points: number;
  tier: string;
  visits: number;
  birthDate: string | null;
  /** true՝ հենց հիմա ստեղծված դրամարկղից */
  isNew?: boolean;
  rewards: BonusRewardItem[];
}

/** Հայկական հեռախոս՝ 0XX XXX XXX (9 թվանշան)։ */
function normalizeArmPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('0')) return digits;
  if (digits.length === 8) return `0${digits}`;
  // +374XXXXXXXX
  if (digits.length === 11 && digits.startsWith('374')) {
    return `0${digits.slice(3)}`;
  }
  return null;
}

async function loadBonusCustomerPayload(
  userId: number,
  options?: { isNew?: boolean }
): Promise<BonusCustomer | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      bonusPoints: true,
      bonusTier: true,
      bonusVisits: true,
      birthDate: true,
    },
  });
  if (!user) return null;

  const rewards = await prisma.bonusReward.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { pointsCost: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      pointsCost: true,
      kind: true,
      productId: true,
      discountAmount: true,
      product: { select: { name: true } },
    },
  });

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    points: user.bonusPoints,
    tier: user.bonusTier,
    visits: user.bonusVisits,
    birthDate: user.birthDate
      ? user.birthDate.toISOString().slice(0, 10)
      : null,
    isNew: options?.isNew ?? false,
    rewards: rewards.map((reward) => ({
      id: reward.id,
      name: reward.name,
      description: reward.description,
      pointsCost: reward.pointsCost,
      kind: reward.kind,
      productId: reward.productId,
      productName: reward.product?.name ?? null,
      discountAmount: reward.discountAmount,
      affordable: user.bonusPoints >= reward.pointsCost,
    })),
  };
}

/** Դրամարկղում հաճախորդի որոնում հեռախոսահամարով։ */
export async function findBonusCustomerByPhone(rawPhone: string): Promise<{
  success: boolean;
  error: string | null;
  customer: BonusCustomer | null;
}> {
  const staff = await requireStaff();
  if (!staff) {
    return { success: false, error: 'Մուտքն արգելված է', customer: null };
  }

  const phone = normalizeArmPhone(rawPhone);
  if (!phone) {
    return {
      success: false,
      error: 'Մուտքագրեք վավեր հեռախոսահամար (0XX XXX XXX)',
      customer: null,
    };
  }
  if (phone === WALK_IN_PHONE) {
    return { success: false, error: 'Սա դրամարկղի ներքին հաշիվն է', customer: null };
  }

  try {
    const settings = await getBonusSettings();
    if (!settings.isActive) {
      return {
        success: false,
        error: 'Բոնուսային համակարգն անջատված է',
        customer: null,
      };
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (!user) {
      return {
        success: false,
        error: 'Այս համարով օգտատեր չի գտնվել',
        customer: null,
      };
    }

    const customer = await loadBonusCustomerPayload(user.id);
    return { success: true, error: null, customer };
  } catch (error) {
    console.error('[Find Bonus Customer] Error:', error);
    return { success: false, error: 'Որոնման սխալ', customer: null };
  }
}

/**
 * Դրամարկղում հաճախորդ՝ գտնել կամ գրանցել հեռախոսով։
 * Եթե հաշիվը կա՝ բոնուսները կգնան նրան, ծննդյան ամսաթիվը թարմացվում է եթե տրված է։
 * Եթե չկա՝ ստեղծվում է նոր օգտատեր (անանուն անունով կամ տրված անունով)։
 */
export async function findOrCreateBonusCustomer(data: {
  phone: string;
  name?: string | null;
  birthDate?: string | null;
}): Promise<{
  success: boolean;
  error: string | null;
  customer: BonusCustomer | null;
  created: boolean;
}> {
  const staff = await requireStaff();
  if (!staff) {
    return {
      success: false,
      error: 'Մուտքն արգելված է',
      customer: null,
      created: false,
    };
  }

  const phone = normalizeArmPhone(data.phone);
  if (!phone) {
    return {
      success: false,
      error: 'Մուտքագրեք վավեր հեռախոսահամար (0XX XXX XXX)',
      customer: null,
      created: false,
    };
  }
  if (phone === WALK_IN_PHONE) {
    return {
      success: false,
      error: 'Սա դրամարկղի ներքին հաշիվն է',
      customer: null,
      created: false,
    };
  }

  let birth: Date | null = null;
  if (data.birthDate?.trim()) {
    const parsed = validateBirthDate(data.birthDate.trim());
    if (!parsed.ok) {
      return {
        success: false,
        error: parsed.error,
        customer: null,
        created: false,
      };
    }
    birth = parsed.date;
  }

  try {
    const settings = await getBonusSettings();
    if (!settings.isActive) {
      return {
        success: false,
        error: 'Բոնուսային համակարգն անջատված է',
        customer: null,
        created: false,
      };
    }

    const existing = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, birthDate: true, name: true },
    });

    if (existing) {
      const updates: { birthDate?: Date; name?: string } = {};
      if (birth && !existing.birthDate) {
        updates.birthDate = birth;
      } else if (birth && existing.birthDate) {
        // Ադմին/գանձապահը կարող է թարմացնել ծննդյան ամսաթիվը
        updates.birthDate = birth;
      }
      const trimmedName = data.name?.trim();
      if (trimmedName && (!existing.name || existing.name === 'Անանուն')) {
        updates.name = trimmedName;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.user.update({ where: { id: existing.id }, data: updates });
      }

      await grantWelcomeBonus(existing.id);
      await grantBirthdayBonusIfDue(existing.id);
      await ensureReferralCode(existing.id);

      const customer = await loadBonusCustomerPayload(existing.id);
      return { success: true, error: null, customer, created: false };
    }

    const password = await bcrypt.hash(
      `box-office-${phone}-${Date.now()}`,
      10
    );
    const created = await prisma.user.create({
      data: {
        name: data.name?.trim() || 'Անանուն',
        phone,
        password,
        role: 'user',
        birthDate: birth,
        phoneVerified: false,
        emailVerified: false,
      },
      select: { id: true },
    });

    await grantWelcomeBonus(created.id);
    await ensureReferralCode(created.id);
    if (birth) {
      await grantBirthdayBonusIfDue(created.id);
    }

    const customer = await loadBonusCustomerPayload(created.id, { isNew: true });
    revalidatePath('/admin/bonus');
    revalidatePath('/admin/users');
    return { success: true, error: null, customer, created: true };
  } catch (error: unknown) {
    console.error('[Find Or Create Bonus Customer] Error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      // Մրցակցային ստեղծում՝ կրկին փորձել գտնել
      const again = await findBonusCustomerByPhone(phone);
      return {
        success: again.success,
        error: again.error,
        customer: again.customer,
        created: false,
      };
    }
    return {
      success: false,
      error: 'Հաճախորդը գրանցելիս սխալ է տեղի ունեցել',
      customer: null,
      created: false,
    };
  }
}

// ─── Ադմին. կանոններ ────────────────────────────────────────────────────────

export interface AdminBonusOverview {
  settings: BonusSettingsValues;
  rewards: Array<{
    id: number;
    name: string;
    description: string | null;
    pointsCost: number;
    kind: string;
    productId: number | null;
    productName: string | null;
    discountAmount: number;
    isActive: boolean;
    sortOrder: number;
    redeemedCount: number;
  }>;
  products: Array<{ id: number; name: string; price: number }>;
  stats: {
    members: number;
    totalOutstanding: number;
    earnedTotal: number;
    redeemedTotal: number;
    tierCounts: Record<string, number>;
  };
  topMembers: Array<{
    id: number;
    name: string | null;
    phone: string;
    points: number;
    tier: string;
    visits: number;
  }>;
  recent: BonusHistoryItem[];
}

export async function getAdminBonusOverview(): Promise<{
  success: boolean;
  error: string | null;
  data: AdminBonusOverview | null;
}> {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: 'Մուտքն արգելված է', data: null };
  }

  try {
    const settings = await getBonusSettings();

    const [rewards, products, members, earned, redeemed, tiers, top, recent] =
      await Promise.all([
        prisma.bonusReward.findMany({
          orderBy: [{ sortOrder: 'asc' }, { pointsCost: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            pointsCost: true,
            kind: true,
            productId: true,
            discountAmount: true,
            isActive: true,
            sortOrder: true,
            product: { select: { name: true } },
            _count: { select: { transactions: true } },
          },
        }),
        prisma.product.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, price: true },
        }),
        prisma.user.aggregate({
          where: { bonusPoints: { gt: 0 }, phone: { not: WALK_IN_PHONE } },
          _count: { _all: true },
          _sum: { bonusPoints: true },
        }),
        prisma.bonusTransaction.aggregate({
          where: { points: { gt: 0 } },
          _sum: { points: true },
        }),
        prisma.bonusTransaction.aggregate({
          where: { points: { lt: 0 } },
          _sum: { points: true },
        }),
        prisma.user.groupBy({
          by: ['bonusTier'],
          where: { phone: { not: WALK_IN_PHONE } },
          _count: { _all: true },
        }),
        prisma.user.findMany({
          where: { phone: { not: WALK_IN_PHONE }, bonusPoints: { gt: 0 } },
          orderBy: { bonusPoints: 'desc' },
          take: 20,
          select: {
            id: true,
            name: true,
            phone: true,
            bonusPoints: true,
            bonusTier: true,
            bonusVisits: true,
          },
        }),
        prisma.bonusTransaction.findMany({
          orderBy: { createdAt: 'desc' },
          take: 40,
          select: {
            id: true,
            type: true,
            points: true,
            balanceAfter: true,
            description: true,
            createdAt: true,
            user: { select: { name: true, phone: true } },
          },
        }),
      ]);

    const tierCounts: Record<string, number> = {};
    for (const row of tiers) {
      tierCounts[row.bonusTier] = row._count._all;
    }

    return {
      success: true,
      error: null,
      data: {
        settings,
        rewards: rewards.map((reward) => ({
          id: reward.id,
          name: reward.name,
          description: reward.description,
          pointsCost: reward.pointsCost,
          kind: reward.kind,
          productId: reward.productId,
          productName: reward.product?.name ?? null,
          discountAmount: reward.discountAmount,
          isActive: reward.isActive,
          sortOrder: reward.sortOrder,
          redeemedCount: reward._count.transactions,
        })),
        products,
        stats: {
          members: members._count._all,
          totalOutstanding: members._sum.bonusPoints ?? 0,
          earnedTotal: earned._sum.points ?? 0,
          redeemedTotal: Math.abs(redeemed._sum.points ?? 0),
          tierCounts,
        },
        topMembers: top.map((user) => ({
          id: user.id,
          name: user.name,
          phone: user.phone,
          points: user.bonusPoints,
          tier: user.bonusTier,
          visits: user.bonusVisits,
        })),
        recent: recent.map((row) => ({
          id: row.id,
          type: row.type,
          typeLabel: BONUS_TYPE_LABELS_HY[row.type] ?? row.type,
          points: row.points,
          balanceAfter: row.balanceAfter,
          description: `${row.user.name || row.user.phone} · ${row.description}`,
          createdAt: row.createdAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    console.error('[Admin Bonus Overview] Error:', error);
    return {
      success: false,
      error: 'Բոնուսային տվյալները բեռնելիս սխալ է տեղի ունեցել',
      data: null,
    };
  }
}

export interface UpdateBonusSettingsData {
  isActive: boolean;
  amountPerPoint: number;
  ticketMultiplier: number;
  productMultiplier: number;
  welcomePoints: number;
  birthdayPoints: number;
  referralInviterPoints: number;
  referralInvitedPoints: number;
  bonusWeekdays: number[];
  bonusDayMultiplier: number;
  goldVisits: number;
  platinumVisits: number;
  goldMultiplier: number;
  platinumMultiplier: number;
}

export async function updateBonusSettings(data: UpdateBonusSettingsData) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: 'Մուտքն արգելված է' };

  if (data.amountPerPoint <= 0) {
    return { success: false, error: 'Միավորի արժեքը պետք է 0-ից մեծ լինի' };
  }
  if (data.platinumVisits <= data.goldVisits) {
    return {
      success: false,
      error: 'Պլատինի այցերի շեմը պետք է Ոսկուց մեծ լինի',
    };
  }

  try {
    const weekdays = data.bonusWeekdays
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .join(',');

    await prisma.bonusSettings.upsert({
      where: { id: 1 },
      update: {
        isActive: data.isActive,
        amountPerPoint: data.amountPerPoint,
        ticketMultiplier: data.ticketMultiplier,
        productMultiplier: data.productMultiplier,
        welcomePoints: Math.max(0, Math.round(data.welcomePoints)),
        birthdayPoints: Math.max(0, Math.round(data.birthdayPoints)),
        referralInviterPoints: Math.max(
          0,
          Math.round(data.referralInviterPoints)
        ),
        referralInvitedPoints: Math.max(
          0,
          Math.round(data.referralInvitedPoints)
        ),
        bonusWeekdays: weekdays,
        bonusDayMultiplier: data.bonusDayMultiplier,
        goldVisits: Math.max(1, Math.round(data.goldVisits)),
        platinumVisits: Math.max(2, Math.round(data.platinumVisits)),
        goldMultiplier: data.goldMultiplier,
        platinumMultiplier: data.platinumMultiplier,
      },
      create: { id: 1 },
    });

    revalidatePath('/admin/bonus');
    revalidatePath('/account');
    return { success: true, message: 'Կանոնները պահպանված են' };
  } catch (error) {
    console.error('[Update Bonus Settings] Error:', error);
    return { success: false, error: 'Պահպանելիս սխալ է տեղի ունեցել' };
  }
}

// ─── Ադմին. պարգևների կատալոգ ───────────────────────────────────────────────

export interface BonusRewardInput {
  id?: number;
  name: string;
  description?: string | null;
  pointsCost: number;
  kind: 'product' | 'ticket' | 'discount';
  productId?: number | null;
  discountAmount?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export async function saveBonusReward(data: BonusRewardInput) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: 'Մուտքն արգելված է' };

  if (!data.name.trim()) {
    return { success: false, error: 'Պարգևի անվանումը պարտադիր է' };
  }
  if (data.pointsCost <= 0) {
    return { success: false, error: 'Միավորների արժեքը պետք է 0-ից մեծ լինի' };
  }
  if (data.kind === 'product' && !data.productId) {
    return { success: false, error: 'Ընտրեք ապրանքը' };
  }
  if (data.kind === 'discount' && (data.discountAmount ?? 0) <= 0) {
    return { success: false, error: 'Նշեք զեղչի գումարը' };
  }

  try {
    const payload = {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      pointsCost: Math.round(data.pointsCost),
      kind: data.kind,
      productId: data.kind === 'product' ? data.productId! : null,
      discountAmount:
        data.kind === 'discount' ? Math.max(0, data.discountAmount ?? 0) : 0,
      isActive: data.isActive ?? true,
      sortOrder: Math.round(data.sortOrder ?? 0),
    };

    if (data.id) {
      await prisma.bonusReward.update({ where: { id: data.id }, data: payload });
    } else {
      await prisma.bonusReward.create({ data: payload });
    }

    revalidatePath('/admin/bonus');
    revalidatePath('/account');
    return { success: true, message: 'Պարգևը պահպանված է' };
  } catch (error) {
    console.error('[Save Bonus Reward] Error:', error);
    return { success: false, error: 'Պարգևը պահպանելիս սխալ է տեղի ունեցել' };
  }
}

export async function deleteBonusReward(id: number) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: 'Մուտքն արգելված է' };

  try {
    const used = await prisma.bonusTransaction.count({ where: { rewardId: id } });
    if (used > 0) {
      // Պատմությունը չենք կորցնում՝ միայն թաքցնում ենք կատալոգից
      await prisma.bonusReward.update({
        where: { id },
        data: { isActive: false },
      });
      revalidatePath('/admin/bonus');
      return {
        success: true,
        message: 'Պարգևն ունի օգտագործման պատմություն — դարձել է ոչ ակտիվ',
      };
    }

    await prisma.bonusReward.delete({ where: { id } });
    revalidatePath('/admin/bonus');
    return { success: true, message: 'Պարգևը ջնջված է' };
  } catch (error) {
    console.error('[Delete Bonus Reward] Error:', error);
    return { success: false, error: 'Ջնջելիս սխալ է տեղի ունեցել' };
  }
}

// ─── Ադմին. ձեռքով ճշգրտում և որոնում ───────────────────────────────────────

export async function adjustUserBonusPoints(data: {
  userId: number;
  points: number;
  note: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: 'Մուտքն արգելված է' };

  const points = Math.round(data.points);
  if (!points) {
    return { success: false, error: 'Նշեք միավորների քանակը (+ կամ −)' };
  }
  if (!data.note.trim()) {
    return { success: false, error: 'Նշեք ճշգրտման պատճառը' };
  }

  try {
    const result = await recordBonusMovement(prisma, {
      userId: data.userId,
      points,
      type: 'admin_adjust',
      description: data.note.trim(),
      createdById: admin.id,
    });
    if (!result) {
      return { success: false, error: 'Օգտատերը հասանելի չէ բոնուսի համար' };
    }

    revalidatePath('/admin/bonus');
    return {
      success: true,
      message: `Կիրառվեց ${result.applied > 0 ? '+' : ''}${result.applied} միավոր։ Մնացորդ՝ ${result.balance}`,
    };
  } catch (error) {
    console.error('[Adjust Bonus Points] Error:', error);
    return { success: false, error: 'Ճշգրտելիս սխալ է տեղի ունեցել' };
  }
}

export async function searchBonusMembers(query: string) {
  const staff = await requireStaff();
  if (!staff) return { success: false, error: 'Մուտքն արգելված է', users: [] };

  const term = query.trim();
  if (term.length < 3) {
    return { success: true, error: null, users: [] };
  }

  try {
    const digits = term.replace(/\D/g, '');
    const users = await prisma.user.findMany({
      where: {
        phone: { not: WALK_IN_PHONE },
        OR: [
          { name: { contains: term } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      },
      orderBy: { bonusPoints: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        phone: true,
        bonusPoints: true,
        bonusTier: true,
        bonusVisits: true,
      },
    });
    return { success: true, error: null, users };
  } catch (error) {
    console.error('[Search Bonus Members] Error:', error);
    return { success: false, error: 'Որոնման սխալ', users: [] };
  }
}

/** Օգտատիրոջ ամբողջ շարժը՝ ադմին դետալ պատուհանի համար։ */
export async function getUserBonusLedger(userId: number) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: 'Մուտքն արգելված է', rows: [] };

  try {
    const rows = await prisma.bonusTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        type: true,
        points: true,
        balanceAfter: true,
        description: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      error: null,
      rows: rows.map((row) => ({
        id: row.id,
        type: row.type,
        typeLabel: BONUS_TYPE_LABELS_HY[row.type] ?? row.type,
        points: row.points,
        balanceAfter: row.balanceAfter,
        description: row.description,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('[Get User Bonus Ledger] Error:', error);
    return { success: false, error: 'Բեռնելիս սխալ', rows: [] };
  }
}

/** Մնացորդների վերահաշվարկ ledger-ից՝ անհամապատասխանության դեպքում։ */
export async function recalculateAllBonusBalances() {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: 'Մուտքն արգելված է' };

  try {
    const userIds = await prisma.bonusTransaction.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });
    for (const row of userIds) {
      await recalculateBalance(row.userId);
    }
    revalidatePath('/admin/bonus');
    return {
      success: true,
      message: `Վերահաշվարկվեց ${userIds.length} օգտատիրոջ մնացորդ`,
    };
  } catch (error) {
    console.error('[Recalculate Bonus Balances] Error:', error);
    return { success: false, error: 'Վերահաշվարկելիս սխալ է տեղի ունեցել' };
  }
}

/** Նախադիտում՝ ինչքան միավոր կտա տվյալ գումարը (ադմին էջի կալկուլյատոր)։ */
export async function previewBonusEarn(data: {
  ticketAmount: number;
  productAmount: number;
  tier: string;
}) {
  const staff = await requireStaff();
  if (!staff) return { success: false, error: 'Մուտքն արգելված է', points: 0 };

  const settings = await getBonusSettings();
  const breakdown = computeEarnedPoints({
    ticketAmount: data.ticketAmount,
    productAmount: data.productAmount,
    tier: data.tier,
    settings,
  });
  return {
    success: true,
    error: null,
    points: breakdown.points,
    ticketPoints: breakdown.ticketPoints,
    productPoints: breakdown.productPoints,
    dayMultiplier: breakdown.dayMultiplier,
    tierMultiplier: breakdown.tierMultiplier,
    tierAfter: tierForVisits(0, settings),
  };
}
