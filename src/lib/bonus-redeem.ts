import { prisma } from '@/lib/prisma';
import {
  BonusDb,
  getBonusSettings,
  recordBonusMovement,
  WALK_IN_PHONE,
} from '@/lib/bonus';

/**
 * Պարգևի կիրառում վաճառքի պահին։
 *
 * Զեղչը միշտ կիրառվում է **մեկ թիրախի** վրա (մեկ տոմս կամ ապրանքի մեկ միավոր),
 * որպեսզի ՀԴՄ կտրոնի տողերի գումարը ճշգրիտ համապատասխանի վճարված գումարին
 * (կլորացման տարբերություն չառաջանա)։
 *
 * - `ticket`   → տոմսի գինը դառնում է 0
 * - `product`  → տվյալ ապրանքի մեկ միավորը՝ 0
 * - `discount` → թիրախի գինը նվազում է ֏ գումարով (նվազագույնը՝ 0)
 */

export interface RedemptionPlan {
  rewardId: number;
  rewardName: string;
  userId: number;
  pointsCost: number;
  kind: 'product' | 'ticket' | 'discount';
  /** kind=product → որ ապրանքի միավորն է անվճար */
  productId: number | null;
  /** kind=discount → զեղչի գումար (֏) */
  discountAmount: number;
}

export async function loadRedemptionPlan(
  rewardId: number,
  userId: number,
  db: BonusDb = prisma
): Promise<{ ok: true; plan: RedemptionPlan } | { ok: false; error: string }> {
  const settings = await getBonusSettings(db);
  if (!settings.isActive) {
    return { ok: false, error: 'Բոնուսային համակարգն անջատված է' };
  }

  const [reward, user] = await Promise.all([
    db.bonusReward.findUnique({
      where: { id: rewardId },
      select: {
        id: true,
        name: true,
        pointsCost: true,
        kind: true,
        productId: true,
        discountAmount: true,
        isActive: true,
      },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { bonusPoints: true, phone: true },
    }),
  ]);

  if (!reward || !reward.isActive) {
    return { ok: false, error: 'Պարգևը հասանելի չէ' };
  }
  if (!user || user.phone === WALK_IN_PHONE) {
    return { ok: false, error: 'Հաճախորդը բոնուսային համակարգում չէ' };
  }
  if (user.bonusPoints < reward.pointsCost) {
    return {
      ok: false,
      error: `Միավորները բավարար չեն (անհրաժեշտ է ${reward.pointsCost}, առկա է ${user.bonusPoints})`,
    };
  }

  return {
    ok: true,
    plan: {
      rewardId: reward.id,
      rewardName: reward.name,
      userId,
      pointsCost: reward.pointsCost,
      kind: reward.kind as RedemptionPlan['kind'],
      productId: reward.productId,
      discountAmount: reward.discountAmount,
    },
  };
}

/** Տոմսի գինը պարգևից հետո։ `applied=false`՝ պարգևը այս տոմսին չի վերաբերում։ */
export function applyPlanToTicketPrice(
  plan: RedemptionPlan,
  price: number
): { price: number; applied: boolean } {
  if (plan.kind === 'ticket') return { price: 0, applied: true };
  if (plan.kind === 'discount') {
    return { price: Math.max(0, price - plan.discountAmount), applied: true };
  }
  return { price, applied: false };
}

/** Ապրանքի մեկ միավորի գինը պարգևից հետո։ */
export function applyPlanToProductUnitPrice(
  plan: RedemptionPlan,
  productId: number,
  unitPrice: number
): { price: number; applied: boolean } {
  if (plan.kind === 'product' && plan.productId === productId) {
    return { price: 0, applied: true };
  }
  if (plan.kind === 'discount') {
    return { price: Math.max(0, unitPrice - plan.discountAmount), applied: true };
  }
  return { price: unitPrice, applied: false };
}

/** Միավորները հանել՝ վաճառքի հաջող ձևակերպումից հետո (transaction-ի ներսում)։ */
export async function commitRedemption(
  db: BonusDb,
  plan: RedemptionPlan,
  refs: {
    orderId?: number | null;
    ticketId?: number | null;
    cashierId?: number | null;
  }
): Promise<number> {
  const result = await recordBonusMovement(db, {
    userId: plan.userId,
    points: -plan.pointsCost,
    type: 'redeem',
    description: `Պարգև՝ ${plan.rewardName}`,
    orderId: refs.orderId ?? null,
    ticketId: refs.ticketId ?? null,
    rewardId: plan.rewardId,
    createdById: refs.cashierId ?? null,
    requireFullAmount: true,
  });
  if (!result || Math.abs(result.applied) < plan.pointsCost) {
    throw new Error('BONUS_INSUFFICIENT');
  }
  return Math.abs(result.applied);
}
