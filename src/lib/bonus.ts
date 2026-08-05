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
    create: { id: 1 },
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
 */
export async function recordBonusMovement(
  db: BonusDb,
  input: LedgerInput
): Promise<{ applied: number; balance: number } | null> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { bonusPoints: true, phone: true },
  });
  if (!user || user.phone === WALK_IN_PHONE) return null;

  // Ծախսը չի կարող գերազանցել առկա մնացորդը
  const applied =
    input.points < 0
      ? -Math.min(user.bonusPoints, Math.abs(input.points))
      : Math.round(input.points);
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

/**
 * Վճարված վաճառքի համար միավորներ + այց + մակարդակ + ծննդյան/ողջույնի բոնուս։
 * Անվտանգ է կանչել ցանկացած վաճառքից հետո՝ walk-in հաշիվը լռելյայն բաց է թողնվում։
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

  const breakdown = computeEarnedPoints({
    ticketAmount: input.ticketAmount,
    productAmount: input.productAmount,
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

  const tier = await registerVisitAndTier(db, input.userId, settings);
  return { points: breakdown.points, tier };
}

/**
 * Վերադարձի/չեղարկման դեպքում՝ հետ վերցնել այս պատվերի համար տրված միավորները։
 * Եթե մնացորդն արդեն ծախսված է, հանվում է առկա չափով (մնացորդը՝ ≥ 0)։
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

  const alreadyRevoked = await db.bonusTransaction.aggregate({
    where: { orderId, type: 'revoke' },
    _sum: { points: true },
  });

  const totalEarned = earned.reduce((sum, row) => sum + row.points, 0);
  const revokedSoFar = Math.abs(alreadyRevoked._sum.points ?? 0);
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
  return Math.abs(result?.applied ?? 0);
}

/** Նույնը՝ առանձին տոմսի չեղարկման համար։ */
export async function revokeBonusForTicket(
  db: BonusDb,
  ticketId: number,
  createdById?: number | null
): Promise<number> {
  const earned = await db.bonusTransaction.findMany({
    where: { ticketId, type: 'earn' },
    select: { userId: true, points: true },
  });
  if (earned.length === 0) return 0;

  const alreadyRevoked = await db.bonusTransaction.aggregate({
    where: { ticketId, type: 'revoke' },
    _sum: { points: true },
  });

  const totalEarned = earned.reduce((sum, row) => sum + row.points, 0);
  const revokedSoFar = Math.abs(alreadyRevoked._sum.points ?? 0);
  const toRevoke = totalEarned - revokedSoFar;
  if (toRevoke <= 0) return 0;

  const result = await recordBonusMovement(db, {
    userId: earned[0].userId,
    points: -toRevoke,
    type: 'revoke',
    description: `Չեղարկված տոմս #${ticketId}`,
    ticketId,
    createdById: createdById ?? null,
  });
  return Math.abs(result?.applied ?? 0);
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

  await db.user.update({
    where: { id: userId },
    data: { welcomeBonusAt: new Date() },
  });
  const result = await recordBonusMovement(db, {
    userId,
    points: settings.welcomePoints,
    type: 'welcome',
    description: 'Ողջույնի բոնուս գրանցման համար',
  });
  return result?.applied ?? 0;
}

/**
 * Ծննդյան բոնուս՝ տարին մեկ, ծննդյան օրվանից ±7 օր պատուհանում։
 * Կանչվում է հաշվի էջ մտնելիս (cron չի պահանջվում)։
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

  const now = new Date();
  const year = now.getFullYear();
  if (user.birthdayBonusYear === year) return 0;

  const birthday = new Date(user.birthDate);
  const thisYearBirthday = new Date(
    year,
    birthday.getMonth(),
    birthday.getDate()
  );
  const diffDays = Math.abs(
    (now.getTime() - thisYearBirthday.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays > 7) return 0;

  await db.user.update({
    where: { id: userId },
    data: { birthdayBonusYear: year },
  });
  const result = await recordBonusMovement(db, {
    userId,
    points: settings.birthdayPoints,
    type: 'birthday',
    description: 'Ծննդյան օրվա բոնուս',
  });
  return result?.applied ?? 0;
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

  await db.user.update({
    where: { id: invitedUserId },
    data: { referredById: inviter.id },
  });

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

