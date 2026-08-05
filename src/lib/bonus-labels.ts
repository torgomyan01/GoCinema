/**
 * Բոնուսային համակարգի պիտակներ և տիպեր՝ առանց DB կապի,
 * որպեսզի հասանելի լինեն նաև client կոմպոնենտներից։
 */

export const BONUS_TIERS = ['silver', 'gold', 'platinum'] as const;
export type BonusTier = (typeof BONUS_TIERS)[number];

export const TIER_LABELS_HY: Record<string, string> = {
  silver: 'Արծաթ',
  gold: 'Ոսկի',
  platinum: 'Պլատին',
};

export const BONUS_TYPE_LABELS_HY: Record<string, string> = {
  earn: 'Վաստակ գնումից',
  redeem: 'Պարգևի օգտագործում',
  welcome: 'Ողջույնի բոնուս',
  birthday: 'Ծննդյան բոնուս',
  referral_inviter: 'Հրավիրված ընկեր',
  referral_invited: 'Հրավերի կոդ',
  admin_adjust: 'Ադմինի ճշգրտում',
  revoke: 'Հետ վերցված (վերադարձ)',
};

export const REWARD_KIND_LABELS_HY: Record<string, string> = {
  product: 'Անվճար ապրանք',
  ticket: 'Անվճար տոմս',
  discount: 'Գումարային զեղչ',
};

export function formatPoints(points: number): string {
  return `${Math.round(points).toLocaleString('hy-AM')} միավոր`;
}
