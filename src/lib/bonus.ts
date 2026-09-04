import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Բոնուսային համակարգի հիմնական տրամաբանությունը։
 *
 * Վաստակ՝ միավոր = floor(գումար / amountPerPoint × տիպի × մակարդակի × օրվա գործակից)
 * Ծախս՝ `BonusReward` կատալոգից՝ պարգևի տողի գինը իջեցվում է (ՀԴՄ-ում՝ զեղչված գնով)։
 *
 * `User.bonusPoints`-ը միշտ պահվում է համաժամ `BonusTransaction`-ների գումարի հետ,
 * ուստի բոլոր փոփոխությունները պետք է անցնեն այս ֆայլի ֆունկցիաներով։
 */

/** Prisma client կամ transaction client — բոլոր ֆունկցիաները աշխատում են երկուսի հետ։ */
export type BonusDb = PrismaClient | Prisma.TransactionClient;

/** Դրամարկղի ընդհանուր (walk-in) հաշիվը՝ բոնուս չի ստանում։ */
export const WALK_IN_PHONE = '000000000';

import {
  BONUS_TYPE_LABELS_HY,
  type BonusTier,
} from '@/lib/bonus-labels';

export {
  BONUS_TIERS,
  BONUS_TYPE_LABELS_HY,
  REWARD_KIND_LABELS_HY,
  TIER_LABELS_HY,
} from '@/lib/bonus-labels';
export type { BonusTier } from '@/lib/bonus-labels';

export interface BonusSettingsValues {
  isActive: boolean;
  amountPerPoint: number;
  ticketMultiplier: number;
  productMultiplier: number;
  welcomePoints: number;
  birthdayPoints: number;
  referralInviterPoints: number;
  referralInvitedPoints: number;
  bonusWeekdays: string;
  bonusDayMultiplier: number;
  goldVisits: number;
  platinumVisits: number;
  goldMultiplier: number;
  platinumMultiplier: number;
}

/** Կանոնները՝ առաջին դիմումի ժամանակ ստեղծվում է լռելյայն տողը (id=1)։ */
export async function getBonusSettings(
  db: BonusDb = prisma
): Promise<BonusSettingsValues> {
  const row = await db.bonusSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ticketMultiplier: 0.5 },
  });
  return {
    isActive: row.isActive,
    amountPerPoint: row.amountPerPoint,
    ticketMultiplier: row.ticketMultiplier,
    productMultiplier: row.productMultiplier,
    welcomePoints: row.welcomePoints,
    birthdayPoints: row.birthdayPoints,
    referralInviterPoints: row.referralInviterPoints,
    referralInvitedPoints: row.referralInvitedPoints,
    bonusWeekdays: row.bonusWeekdays,
    bonusDayMultiplier: row.bonusDayMultiplier,
    goldVisits: row.goldVisits,
    platinumVisits: row.platinumVisits,
    goldMultiplier: row.goldMultiplier,
    platinumMultiplier: row.platinumMultiplier,
  };
}

export function parseBonusWeekdays(raw: string): number[] {
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export function isBonusDay(date: Date, settings: BonusSettingsValues): boolean {
  return parseBonusWeekdays(settings.bonusWeekdays).includes(date.getDay());
}

export function tierMultiplier(
  tier: string,
  settings: BonusSettingsValues
): number {
  if (tier === 'platinum') return settings.platinumMultiplier;
  if (tier === 'gold') return settings.goldMultiplier;
  return 1;
}

export function tierForVisits(
  visits: number,
  settings: BonusSettingsValues
): BonusTier {
  if (visits >= settings.platinumVisits) return 'platinum';
  if (visits >= settings.goldVisits) return 'gold';
  return 'silver';
}

export interface EarnInput {
  /** Տոմսերի գումար (֏) */
  ticketAmount: number;
  /** Ապրանքների գումար (֏) */
  productAmount: number;
  tier: string;
  settings: BonusSettingsValues;
  at?: Date;
}

export interface EarnBreakdown {
  points: number;
  ticketPoints: number;
  productPoints: number;
  dayMultiplier: number;
  tierMultiplier: number;
}

/** Քանի՞ միավոր է տալիս տվյալ վաճառքը (առանց DB-ի)։ */
export function computeEarnedPoints(input: EarnInput): EarnBreakdown {
  const { settings } = input;
  const at = input.at ?? new Date();
  const perPoint = settings.amountPerPoint > 0 ? settings.amountPerPoint : 100;
  const dayMult = isBonusDay(at, settings) ? settings.bonusDayMultiplier : 1;
  const tierMult = tierMultiplier(input.tier, settings);
  const combined = dayMult * tierMult;

  const ticketAmount = Math.max(0, input.ticketAmount);
  const productAmount = Math.max(0, input.productAmount);

  const ticketPoints = Math.floor(
    (ticketAmount / perPoint) * settings.ticketMultiplier * combined
  );
  const productPoints = Math.floor(
    (productAmount / perPoint) * settings.productMultiplier * combined
  );

  return {
    points: ticketPoints + productPoints,
    ticketPoints,
    productPoints,
    dayMultiplier: dayMult,
    tierMultiplier: tierMult,
  };
}

export function generateReferralCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `GC${code}`;
}

/** Օգտատիրոջ հրավերի կոդը (ստեղծում է, եթե դեռ չկա)։ */
export async function ensureReferralCode(
  userId: number,
  db: BonusDb = prisma
): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, phone: true },
  });
  if (!user || user.phone === WALK_IN_PHONE) return null;
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReferralCode();
    const taken = await db.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (taken) continue;
    await db.user.update({ where: { id: userId }, data: { referralCode: code } });
    return code;
  }
  return null;
}

interface LedgerInput {
  userId: number;
  points: number;
  type: keyof typeof BONUS_TYPE_LABELS_HY | string;
  description: string;
  orderId?: number | null;
  ticketId?: number | null;
  rewardId?: number | null;
  createdById?: number | null;
}

/**
 * Միավորների շարժ՝ ledger + մնացորդի թարմացում մեկ քայլով։
 * `points` > 0՝ վաստակ, < 0՝ ծախս։ Մնացորդը երբեք չի դառնում բացասական։
 * Տողը կողպվում է `FOR UPDATE`-ով՝ concurrent կորուստներից խուսափելու համար։
 */
export async function recordBonusMovement(
  db: BonusDb,
  input: LedgerInput & { requireFullAmount?: boolean }
): Promise<{ applied: number; balance: number } | null> {
  const locked = await db.$queryRaw<
    Array<{ id: number; bonusPoints: number; phone: string }>
  >`
    SELECT id, bonusPoints, phone FROM users WHERE id = ${input.userId} FOR UPDATE
  `;
  const user = locked[0];
  if (!user || user.phone === WALK_IN_PHONE) return null;

  const requested = Math.round(input.points);
  let applied: number;
  if (requested < 0) {
    const need = Math.abs(requested);
    if (input.requireFullAmount && user.bonusPoints < need) {
      return null;
    }
    applied = -Math.min(user.bonusPoints, need);
  } else {
    applied = requested;
  }
  if (applied === 0) return { applied: 0, balance: user.bonusPoints };

  const balance = user.bonusPoints + applied;

  await db.user.update({
    where: { id: input.userId },
    data: { bonusPoints: balance },
  });

  await db.bonusTransaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      points: applied,
      balanceAfter: balance,
      description: input.description.slice(0, 255),
      orderId: input.orderId ?? null,
      ticketId: input.ticketId ?? null,
      rewardId: input.rewardId ?? null,
      createdById: input.createdById ?? null,
    },
  });

  return { applied, balance };
}

/** Այցերի քանակը +1 և մակարդակի վերահաշվարկ։ */
export async function registerVisitAndTier(
  db: BonusDb,
  userId: number,
  settings: BonusSettingsValues
): Promise<BonusTier | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { bonusVisits: true, bonusTier: true, phone: true },
  });
  if (!user || user.phone === WALK_IN_PHONE) return null;

  const visits = user.bonusVisits + 1;
  const tier = tierForVisits(visits, settings);
  await db.user.update({
    where: { id: userId },
    data: { bonusVisits: visits, bonusTier: tier },
  });
  return tier;
}

/** Այցի հետ վերադարձ չեղարկման/վերադարձի ժամանակ։ */
export async function unregisterVisitAndTier(
  db: BonusDb,
  userId: number,
  settings?: BonusSettingsValues
): Promise<BonusTier | null> {
  const rules = settings ?? (await getBonusSettings(db));
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { bonusVisits: true, phone: true },
  });
  if (!user || user.phone === WALK_IN_PHONE) return null;

  const visits = Math.max(0, user.bonusVisits - 1);
  const tier = tierForVisits(visits, rules);
  await db.user.update({
    where: { id: userId },
    data: { bonusVisits: visits, bonusTier: tier },
  });
  return tier;
}

export interface AwardSaleInput {
  userId: number;
  ticketAmount: number;
  productAmount: number;
  orderId?: number | null;
  ticketId?: number | null;
  /** Վաճառքի աղբյուրը՝ նկարագրության մեջ */
  source?: 'online' | 'box_office' | 'scanner';
  at?: Date;
}

const SOURCE_LABELS: Record<string, string> = {
  online: 'Օնլայն գնում',
  box_office: 'Դրամարկղի վաճառք',
  scanner: 'Դրամարկղ (սկաներ)',
};

/** Արդեն տրվա՞ծ է այս տոմսային վաճառքի earn-ը (idempotency կրկնակի finalize-ի դեմ)։ */
async function hasExistingSaleEarn(
  db: BonusDb,
  input: Pick<AwardSaleInput, 'orderId' | 'ticketId' | 'ticketAmount'>
): Promise<boolean> {
  const ticketAmount = Math.max(0, input.ticketAmount);
  // Ապրանք-միայն վաճառքները կարող են նույն պատվերին մի քանի անգամ ավելանալ
  if (ticketAmount <= 0) return false;

  if (input.ticketId) {
    const byTicket = await db.bonusTransaction.findFirst({
      where: { ticketId: input.ticketId, type: 'earn' },
      select: { id: true },
    });
    if (byTicket) return true;
  }
  if (input.orderId) {
    const byOrder = await db.bonusTransaction.findFirst({
      where: { orderId: input.orderId, type: 'earn' },
      select: { id: true },
    });
    if (byOrder) return true;
  }
  return false;
}

/**
 * Վճարված վաճառքի համար միավորներ + այց + մակարդակ։
 * Կրկնակի կանչը նույն orderId/ticketId-ով չի տալիս կրկնակի միավորներ։
 */
export async function awardBonusForSale(
  db: BonusDb,
  input: AwardSaleInput
): Promise<{ points: number; tier: BonusTier | null } | null> {
  const settings = await getBonusSettings(db);
  if (!settings.isActive) return null;

  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { bonusTier: true, phone: true },
  });
  if (!user || user.phone === WALK_IN_PHONE) return null;

  if (await hasExistingSaleEarn(db, input)) {
    return { points: 0, tier: user.bonusTier as BonusTier };
  }

  const ticketAmount = Math.max(0, input.ticketAmount);
  const productAmount = Math.max(0, input.productAmount);
  const paidAmount = ticketAmount + productAmount;

  const breakdown = computeEarnedPoints({
    ticketAmount,
    productAmount,
    tier: user.bonusTier,
    settings,
    at: input.at,
  });

  const label = SOURCE_LABELS[input.source ?? 'online'] ?? 'Գնում';
  if (breakdown.points > 0) {
    await recordBonusMovement(db, {
      userId: input.userId,
      points: breakdown.points,
      type: 'earn',
      description:
        breakdown.dayMultiplier > 1
          ? `${label} (×${breakdown.dayMultiplier} բոնուսային օր)`
          : label,
      orderId: input.orderId ?? null,
      ticketId: input.ticketId ?? null,
    });
  }

  // Այց՝ միայն իրական վճարված գումարի դեպքում (ոչ ամբողջովին անվճար պարգև)
  const tier =
    paidAmount > 0
      ? await registerVisitAndTier(db, input.userId, settings)
      : (user.bonusTier as BonusTier);

  return { points: breakdown.points, tier };
}

/** Պատվերի scope-ում արդեն հետ վերցված միավորներ (order կամ նրա տոմսերի revoke)։ */
async function sumRevokedForOrderScope(
  db: BonusDb,
  orderId: number
): Promise<number> {
  const ticketIds = (
    await db.ticket.findMany({
      where: { orderId },
      select: { id: true },
    })
  ).map((row) => row.id);

  const agg = await db.bonusTransaction.aggregate({
    where: {
      type: 'revoke',
      OR: [
        { orderId },
        ...(ticketIds.length > 0 ? [{ ticketId: { in: ticketIds } }] : []),
      ],
    },
    _sum: { points: true },
  });
  return Math.abs(agg._sum.points ?? 0);
}

async function maybeUnregisterVisitAfterRevoke(
  db: BonusDb,
  userId: number,
  totalEarned: number,
  revokedAfter: number
) {
  if (revokedAfter < totalEarned) return;
  await unregisterVisitAndTier(db, userId);
}

/**
 * Վերադարձի/չեղարկման դեպքում՝ հետ վերցնել այս պատվերի մնացած միավորները։
 * Հաշվի է առնում նաև տոմսի մակարդակի revoke-ները՝ կրկնակի հանումից խուսափելու համար։
 */
export async function revokeBonusForOrder(
  db: BonusDb,
  orderId: number,
  createdById?: number | null
): Promise<number> {
  const earned = await db.bonusTransaction.findMany({
    where: { orderId, type: 'earn' },
    select: { userId: true, points: true },
  });
  if (earned.length === 0) return 0;

  const totalEarned = earned.reduce((sum, row) => sum + row.points, 0);
  const revokedSoFar = await sumRevokedForOrderScope(db, orderId);
  const toRevoke = totalEarned - revokedSoFar;
  if (toRevoke <= 0) return 0;

  const result = await recordBonusMovement(db, {
    userId: earned[0].userId,
    points: -toRevoke,
    type: 'revoke',
    description: `Վերադարձ՝ պատվեր #${orderId}`,
    orderId,
    createdById: createdById ?? null,
  });
  const applied = Math.abs(result?.applied ?? 0);
  await maybeUnregisterVisitAfterRevoke(
    db,
    earned[0].userId,
    totalEarned,
    revokedSoFar + applied
  );
  return applied;
}

/**
 * Մասնակի ապրանքի վերադարձ՝ միավորները համամասնորեն հետ վերցնել։
 * `orderValueBefore`՝ պատվերի գումարը մինչև այս վերադարձը։
 */
export async function revokeBonusForOrderPartial(
  db: BonusDb,
  orderId: number,
  refundAmount: number,
  orderValueBefore: number,
  createdById?: number | null
): Promise<number> {
  const refund = Math.max(0, refundAmount);
  const valueBefore = Math.max(0, orderValueBefore);
  if (refund <= 0) return 0;

  // Ամբողջը կամ գրեթե ամբողջը → լրիվ revoke
  if (valueBefore <= 0 || refund >= valueBefore - 0.009) {
    return revokeBonusForOrder(db, orderId, createdById);
  }

  const earned = await db.bonusTransaction.findMany({
    where: { orderId, type: 'earn' },
    select: { userId: true, points: true },
  });
  if (earned.length === 0) return 0;

  const totalEarned = earned.reduce((sum, row) => sum + row.points, 0);
  const revokedSoFar = await sumRevokedForOrderScope(db, orderId);
  const remainingPoints = totalEarned - revokedSoFar;
  if (remainingPoints <= 0) return 0;

  const toRevoke = Math.min(
    remainingPoints,
    Math.floor((remainingPoints * refund) / valueBefore)
  );
  if (toRevoke <= 0) return 0;

  const result = await recordBonusMovement(db, {
    userId: earned[0].userId,
    points: -toRevoke,
    type: 'revoke',
    description: `Մասնակի վերադարձ՝ պատվեր #${orderId}`,
    orderId,
    createdById: createdById ?? null,
  });
  const applied = Math.abs(result?.applied ?? 0);
  await maybeUnregisterVisitAfterRevoke(
    db,
    earned[0].userId,
    totalEarned,
    revokedSoFar + applied
  );
  return applied;
}

/**
 * Տոմսի չեղարկում։
 * - Եթե earn-ը կապված է ticketId-ին՝ հետ է վերցնում այդ earn-ը
 * - Եթե earn-ը միայն order-level է (բազմատեղանի)՝ համամասնորեն
 * Երկու դեպքում էլ order revoke-ի հետ կրկնակի չի հանում։
 */
export async function revokeBonusForTicket(
  db: BonusDb,
  ticketId: number,
  createdById?: number | null
): Promise<number> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, orderId: true, price: true, status: true },
  });
  if (!ticket) return 0;

  const ticketEarns = await db.bonusTransaction.findMany({
    where: { ticketId, type: 'earn' },
    select: { userId: true, points: true, orderId: true },
  });

  if (ticketEarns.length > 0) {
    const totalEarned = ticketEarns.reduce((sum, row) => sum + row.points, 0);
    const orderId = ticketEarns[0].orderId ?? ticket.orderId;

    const ticketRevoked = Math.abs(
      (
        await db.bonusTransaction.aggregate({
          where: { ticketId, type: 'revoke' },
          _sum: { points: true },
        })
      )._sum.points ?? 0
    );
    let toRevoke = totalEarned - ticketRevoked;

    if (orderId) {
      const orderEarnTotal = (
        await db.bonusTransaction.findMany({
          where: { orderId, type: 'earn' },
          select: { points: true },
        })
      ).reduce((sum, row) => sum + row.points, 0);
      const revokedSoFar = await sumRevokedForOrderScope(db, orderId);
      const orderRemaining = orderEarnTotal - revokedSoFar;
      if (orderRemaining <= 0) return 0;
      toRevoke = Math.min(toRevoke, orderRemaining);
    }

    if (toRevoke <= 0) return 0;

    const result = await recordBonusMovement(db, {
      userId: ticketEarns[0].userId,
      points: -toRevoke,
      type: 'revoke',
      description: `Չեղարկված տոմս #${ticketId}`,
      orderId: orderId ?? null,
      ticketId,
      createdById: createdById ?? null,
    });
    const applied = Math.abs(result?.applied ?? 0);

    if (orderId) {
      const orderEarnTotal = (
        await db.bonusTransaction.findMany({
          where: { orderId, type: 'earn' },
          select: { points: true },
        })
      ).reduce((sum, row) => sum + row.points, 0);
      const revokedAfter = await sumRevokedForOrderScope(db, orderId);
      await maybeUnregisterVisitAfterRevoke(
        db,
        ticketEarns[0].userId,
        orderEarnTotal,
        revokedAfter
      );
    } else {
      await maybeUnregisterVisitAfterRevoke(
        db,
        ticketEarns[0].userId,
        totalEarned,
        ticketRevoked + applied
      );
    }
    return applied;
  }

  // Order-level earn (բազմատեղանի վաճառք)՝ համամասին ըստ տոմսի գնի
  if (!ticket.orderId) return 0;

  const orderEarns = await db.bonusTransaction.findMany({
    where: { orderId: ticket.orderId, type: 'earn' },
    select: { userId: true, points: true, ticketId: true },
  });
  // Միայն order-level (առանց ticketId) կամ այլ տոմսերի earn-եր՝ եթե այս տոմսին առանձին չկա
  const scopedEarns = orderEarns.filter((row) => !row.ticketId);
  if (scopedEarns.length === 0) return 0;

  const totalEarned = scopedEarns.reduce((sum, row) => sum + row.points, 0);
  const revokedSoFar = await sumRevokedForOrderScope(db, ticket.orderId);
  const remainingPoints = totalEarned - revokedSoFar;
  if (remainingPoints <= 0) return 0;

  const siblings = await db.ticket.findMany({
    where: { orderId: ticket.orderId },
    select: { id: true, price: true, status: true },
  });
  const remainingPrice = siblings
    .filter((row) => row.status !== 'cancelled')
    .reduce((sum, row) => sum + Math.max(0, row.price), 0);
  const allPrice =
    siblings.reduce((sum, row) => sum + Math.max(0, row.price), 0) || 1;

  const targetKeep = Math.floor((totalEarned * remainingPrice) / allPrice);
  const toRevoke = remainingPoints - targetKeep;
  if (toRevoke <= 0) return 0;

  const result = await recordBonusMovement(db, {
    userId: scopedEarns[0].userId,
    points: -toRevoke,
    type: 'revoke',
    description: `Չեղարկված տոմս #${ticketId} (պատվերի մաս)`,
    orderId: ticket.orderId,
    ticketId,
    createdById: createdById ?? null,
  });
  const applied = Math.abs(result?.applied ?? 0);
  await maybeUnregisterVisitAfterRevoke(
    db,
    scopedEarns[0].userId,
    totalEarned,
    revokedSoFar + applied
  );
  return applied;
}

/** Ողջույնի բոնուս՝ մեկ անգամ, գրանցման կամ առաջին մուտքի ժամանակ։ */
export async function grantWelcomeBonus(
  userId: number,
  db: BonusDb = prisma
): Promise<number> {
  const settings = await getBonusSettings(db);
  if (!settings.isActive || settings.welcomePoints <= 0) return 0;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { welcomeBonusAt: true, phone: true },
  });
  if (!user || user.welcomeBonusAt || user.phone === WALK_IN_PHONE) return 0;

  // Նշել որպես «վերցված» atomic՝ կրկնակի տրամադրումից խուսափելու համար
  const claimed = await db.user.updateMany({
    where: { id: userId, welcomeBonusAt: null },
    data: { welcomeBonusAt: new Date() },
  });
  if (claimed.count === 0) return 0;

  try {
    const result = await recordBonusMovement(db, {
      userId,
      points: settings.welcomePoints,
      type: 'welcome',
      description: 'Ողջույնի բոնուս գրանցման համար',
    });
    const applied = result?.applied ?? 0;
    if (applied <= 0) {
      await db.user.update({
        where: { id: userId },
        data: { welcomeBonusAt: null },
      });
    }
    return applied;
  } catch (error) {
    await db.user.update({
      where: { id: userId },
      data: { welcomeBonusAt: null },
    });
    throw error;
  }
}

function birthdayWindowMatch(
  birthDate: Date,
  now: Date
): { inWindow: boolean; year: number } {
  const month = birthDate.getMonth();
  const day = birthDate.getDate();
  const candidates = [
    new Date(now.getFullYear() - 1, month, day),
    new Date(now.getFullYear(), month, day),
    new Date(now.getFullYear() + 1, month, day),
  ];

  let best = candidates[0];
  let bestDiff = Math.abs(now.getTime() - best.getTime());
  for (let i = 1; i < candidates.length; i += 1) {
    const diff = Math.abs(now.getTime() - candidates[i].getTime());
    if (diff < bestDiff) {
      best = candidates[i];
      bestDiff = diff;
    }
  }

  const diffDays = bestDiff / (24 * 60 * 60 * 1000);
  return { inWindow: diffDays <= 7, year: best.getFullYear() };
}

/**
 * Ծննդյան բոնուս՝ տարին մեկ, ծննդյան օրվանից ±7 օր պատուհանում։
 * Աշխատում է նաև տարեվերջ/տարեսկիզբ անցումով։
 */
export async function grantBirthdayBonusIfDue(
  userId: number,
  db: BonusDb = prisma
): Promise<number> {
  const settings = await getBonusSettings(db);
  if (!settings.isActive || settings.birthdayPoints <= 0) return 0;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { birthDate: true, birthdayBonusYear: true, phone: true },
  });
  if (!user?.birthDate || user.phone === WALK_IN_PHONE) return 0;

  const match = birthdayWindowMatch(new Date(user.birthDate), new Date());
  if (!match.inWindow) return 0;
  if (user.birthdayBonusYear === match.year) return 0;

  const claimed = await db.user.updateMany({
    where: {
      id: userId,
      NOT: { birthdayBonusYear: match.year },
    },
    data: { birthdayBonusYear: match.year },
  });
  if (claimed.count === 0) return 0;

  try {
    const result = await recordBonusMovement(db, {
      userId,
      points: settings.birthdayPoints,
      type: 'birthday',
      description: 'Ծննդյան օրվա բոնուս',
    });
    const applied = result?.applied ?? 0;
    if (applied <= 0) {
      await db.user.update({
        where: { id: userId },
        data: { birthdayBonusYear: user.birthdayBonusYear },
      });
    }
    return applied;
  } catch (error) {
    await db.user.update({
      where: { id: userId },
      data: { birthdayBonusYear: user.birthdayBonusYear },
    });
    throw error;
  }
}

/**
 * Հրավերի կոդի կիրառում՝ գրանցման ժամանակ։ Բոնուսը երկուսին էլ։
 * Վերադարձնում է հրավիրվածի ստացած միավորները (0՝ եթե կոդը վավեր չէ)։
 */
export async function applyReferralCode(
  db: BonusDb,
  invitedUserId: number,
  rawCode: string
): Promise<{ ok: boolean; points: number; error?: string }> {
  const settings = await getBonusSettings(db);
  if (!settings.isActive) return { ok: false, points: 0, error: 'Անհասանելի է' };

  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, points: 0, error: 'Կոդը դատարկ է' };

  const invited = await db.user.findUnique({
    where: { id: invitedUserId },
    select: { referredById: true, referralCode: true },
  });
  if (!invited) return { ok: false, points: 0, error: 'Օգտատերը չի գտնվել' };
  if (invited.referredById) {
    return { ok: false, points: 0, error: 'Հրավերի կոդն արդեն օգտագործված է' };
  }
  if (invited.referralCode === code) {
    return { ok: false, points: 0, error: 'Չեք կարող օգտագործել ձեր կոդը' };
  }

  const inviter = await db.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!inviter || inviter.id === invitedUserId) {
    return { ok: false, points: 0, error: 'Հրավերի կոդը վավեր չէ' };
  }

  const linked = await db.user.updateMany({
    where: { id: invitedUserId, referredById: null },
    data: { referredById: inviter.id },
  });
  if (linked.count === 0) {
    return { ok: false, points: 0, error: 'Հրավերի կոդն արդեն օգտագործված է' };
  }

  try {
    const invitedResult = await recordBonusMovement(db, {
      userId: invitedUserId,
      points: settings.referralInvitedPoints,
      type: 'referral_invited',
      description: `Հրավերի կոդ ${code}`,
    });
    await recordBonusMovement(db, {
      userId: inviter.id,
      points: settings.referralInviterPoints,
      type: 'referral_inviter',
      description: 'Հրավիրված ընկերոջ գրանցում',
    });
    return { ok: true, points: invitedResult?.applied ?? 0 };
  } catch (error) {
    await db.user.update({
      where: { id: invitedUserId },
      data: { referredById: null },
    });
    throw error;
  }
}

/** Մնացորդի վերահաշվարկ ledger-ից (ձեռքով ուղղումների/միգրացիայի համար)։ */
export async function recalculateBalance(
  userId: number,
  db: BonusDb = prisma
): Promise<number> {
  const sum = await db.bonusTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  const balance = Math.max(0, sum._sum.points ?? 0);
  await db.user.update({ where: { id: userId }, data: { bonusPoints: balance } });
  return balance;
}

