'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Coins,
  Copy,
  Crown,
  Gift,
  Loader2,
  CalendarDays,
  Cake,
  Sparkles,
  Link2,
  Share2,
  Ticket,
  ShoppingBag,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';
import { getMyBonus, type MyBonusData } from '@/app/actions/bonus';
import { TIER_LABELS_HY } from '@/lib/bonus-labels';

const WEEKDAY_NAMES = [
  'կիրակի',
  'երկուշաբթի',
  'երեքշաբթի',
  'չորեքշաբթի',
  'հինգշաբթի',
  'ուրբաթ',
  'շաբաթ',
];

const TIER_META: Record<
  string,
  { label: string; accent: string; glow: string; bar: string }
> = {
  silver: {
    label: 'Արծաթ',
    accent: 'from-slate-400 to-slate-600',
    glow: 'bg-slate-400/30',
    bar: 'bg-slate-400',
  },
  gold: {
    label: 'Ոսկի',
    accent: 'from-amber-400 to-orange-500',
    glow: 'bg-amber-400/30',
    bar: 'bg-amber-400',
  },
  platinum: {
    label: 'Պլատին',
    accent: 'from-violet-400 to-fuchsia-500',
    glow: 'bg-violet-400/30',
    bar: 'bg-violet-400',
  },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export default function BonusPageClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [data, setData] = useState<MyBonusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const referralLink = useMemo(() => {
    if (!data?.referralCode) return '';
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}${SITE_URL.REGISTER}?ref=${encodeURIComponent(data.referralCode)}`;
  }, [data?.referralCode]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getMyBonus();
    if (!result.success || !result.data) {
      setError(result.error ?? 'Բեռնման սխալ');
    } else {
      setError(null);
      setData(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(SITE_URL.ACCOUNT);
      return;
    }
    if (status === 'authenticated' && session?.user) {
      void load();
    }
  }, [status, session, router, load]);

  const copyLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (!referralLink || !data) return;
    const text = `Գրանցվիր GoCinema-ում իմ հղումով և ստացիր +${data.referralInvitedPoints} բոնուս միավոր 🍿`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'GoCinema հրավեր',
          text,
          url: referralLink,
        });
        return;
      } catch {
        // օգտատերը չեղարկեց share-ը
      }
    }
    await copyLink();
  };

  const tierProgress = useMemo(() => {
    if (!data?.nextTier) return 100;
    const needed = data.visits + data.visitsToNextTier;
    if (needed <= 0) return 100;
    return Math.min(100, Math.round((data.visits / needed) * 100));
  }, [data]);

  if (status === 'loading' || loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0614]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.35),transparent_55%)]" />
        <Loader2 className="relative h-10 w-10 animate-spin text-violet-300" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-8 py-12 text-center text-lg text-rose-100">
          {error ?? 'Տվյալները հասանելի չեն'}
        </div>
      </Shell>
    );
  }

  if (!data.isActive) {
    return (
      <Shell>
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-16 text-center">
          <Gift className="mx-auto mb-4 h-12 w-12 text-white/30" />
          <p className="text-lg text-white/70">
            Բոնուսային ծրագիրը ժամանակավորապես անհասանելի է
          </p>
        </div>
      </Shell>
    );
  }

  const tier = TIER_META[data.tier] ?? TIER_META.silver;
  const bonusDayLabels = data.bonusWeekdays
    .map((day) => WEEKDAY_NAMES[day])
    .filter(Boolean)
    .join(', ');
  const affordableCount = data.rewards.filter((r) => r.affordable).length;

  const ticketPointsPerUnit = Number(
    (data.ticketMultiplier * data.earnMultiplier).toFixed(2)
  );
  const productPointsPerUnit = Number(
    (data.productMultiplier * data.earnMultiplier).toFixed(2)
  );
  const exampleTicketSpend = 2000;
  const exampleTicketPoints = Math.floor(
    (exampleTicketSpend / data.amountPerPoint) *
      data.ticketMultiplier *
      data.earnMultiplier
  );

  const earnTasks: Array<{
    icon: LucideIcon;
    title: string;
    description: string;
    pointsLabel: string;
    unitLabel: string;
    accent: string;
  }> = [
    {
      icon: Ticket,
      title: 'Տոմս գնել',
      description: `Ամեն ${data.amountPerPoint} ֏ · օր. ${exampleTicketSpend} ֏ → ${exampleTicketPoints}`,
      pointsLabel: `+${ticketPointsPerUnit}`,
      unitLabel: ` / ${data.amountPerPoint} ֏`,
      accent: 'border-violet-400/30 bg-violet-500/10',
    },
    {
      icon: ShoppingBag,
      title: 'Բուֆետ',
      description: `Ամեն ${data.amountPerPoint} ֏ · ×${data.productMultiplier}`,
      pointsLabel: `+${productPointsPerUnit}`,
      unitLabel: ` / ${data.amountPerPoint} ֏`,
      accent: 'border-amber-400/30 bg-amber-500/10',
    },
    {
      icon: CalendarDays,
      title: 'Բոնուսային օրեր',
      description: bonusDayLabels || `Վաստակը ×${data.bonusDayMultiplier}`,
      pointsLabel: `×${data.bonusDayMultiplier}`,
      unitLabel: 'գործակից',
      accent: 'border-sky-400/30 bg-sky-500/10',
    },
    {
      icon: Sparkles,
      title: 'Ողջույնի բոնուս',
      description: 'Մեկ անգամ ակտիվացնելիս',
      pointsLabel: `+${data.welcomePoints}`,
      unitLabel: 'միավոր',
      accent: 'border-emerald-400/30 bg-emerald-500/10',
    },
    {
      icon: Cake,
      title: 'Ծննդյան բոնուս',
      description: 'Ամեն տարի ծննդյան օրը',
      pointsLabel: `+${data.birthdayPoints}`,
      unitLabel: 'միավոր',
      accent: 'border-pink-400/30 bg-pink-500/10',
    },
    {
      icon: Users,
      title: 'Ընկեր հրավիրել',
      description: `Դուք +${data.referralInviterPoints} · ընկերը +${data.referralInvitedPoints}`,
      pointsLabel: `+${data.referralInviterPoints}`,
      unitLabel: 'միավոր',
      accent: 'border-indigo-400/30 bg-indigo-500/10',
    },
    {
      icon: TrendingUp,
      title: 'Մակարդակ',
      description: `Ոսկի ×${data.goldMultiplier} · Պլատին ×${data.platinumMultiplier}`,
      pointsLabel: `×${data.earnMultiplier}`,
      unitLabel: 'ձեր գործակից',
      accent: 'border-yellow-400/30 bg-yellow-500/10',
    },
  ];

  return (
    <Shell>
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link
          href={SITE_URL.ACCOUNT}
          className="inline-flex items-center gap-2 text-base text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          Հաշիվ
        </Link>
        <span
          className={`inline-flex items-center gap-2 rounded-full bg-linear-to-r ${tier.accent} px-4 py-2 text-sm font-bold text-white shadow-lg`}
        >
          <Crown className="h-4 w-4" />
          {TIER_LABELS_HY[data.tier] ?? tier.label}
        </span>
      </div>

      {/* Hero — լայն */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.4 }}
        className="relative mb-8 overflow-hidden rounded-4xl border border-white/10"
      >
        <div className="absolute inset-0 bg-linear-to-br from-[#5b21b6] via-[#7c3aed] to-[#db2777]" />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div
          className={`absolute right-12 top-10 h-32 w-32 rounded-full blur-2xl ${tier.glow}`}
        />

        <div className="relative grid gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-white/60">
              GoCinema Bonus
            </p>
            <h1 className="mb-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Իմ բոնուսները
            </h1>
            <p className="mb-2 flex items-center gap-2 text-base text-white/70">
              <Coins className="h-5 w-5" />
              Հասանելի միավորներ
            </p>
            <motion.p
              key={data.points}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-6xl font-bold tabular-nums tracking-tight text-white sm:text-7xl"
            >
              {data.points.toLocaleString('hy-AM')}
            </motion.p>
            <p className="mt-3 max-w-xl text-base text-white/65">
              Տոմսից՝ ամեն {data.amountPerPoint} ֏-ի դիմաց{' '}
              {data.ticketMultiplier} միավոր
              {data.earnMultiplier > 1
                ? ` · ձեր մակարդակով ×${data.earnMultiplier}`
                : ''}
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-black/25 p-6 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between text-base text-white/75">
              <span className="font-medium">{data.visits} այց</span>
              {data.nextTier ? (
                <span>
                  {TIER_LABELS_HY[data.nextTier]} · մնացել է{' '}
                  {data.visitsToNextTier}
                </span>
              ) : (
                <span>Առավելագույն մակարդակ</span>
              )}
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/15">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${tierProgress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${tier.bar}`}
              />
            </div>
            <p className="mt-4 text-sm text-white/50">
              Որքան շատ այց, այնքան բարձր մակարդակ և ավելի շատ միավոր
            </p>
          </div>
        </div>
      </motion.section>

      {/* Երկու սյուն՝ ձախ / աջ */}
      <div className="grid items-start gap-8 lg:grid-cols-2">
        {/* ՁԱԽ — առաջադրանքներ + հրավեր */}
        <div className="space-y-8">
          <motion.section
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <p className="mb-1 text-sm font-semibold uppercase tracking-[0.18em] text-white/40">
              Առաջադրանքներ
            </p>
            <h2 className="mb-5 text-2xl font-bold text-white sm:text-3xl">
              Ինչից որքան եք ստանում
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {earnTasks.map((task, index) => {
                const Icon = task.icon;
                return (
                  <motion.div
                    key={task.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + index * 0.03 }}
                    className={`flex flex-col rounded-3xl border p-4 ${task.accent}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/30 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold tabular-nums text-white">
                          {task.pointsLabel}
                        </p>
                        <p className="text-xs text-white/45">{task.unitLabel}</p>
                      </div>
                    </div>
                    <p className="text-base font-semibold text-white">
                      {task.title}
                    </p>
                    <p className="mt-1 text-sm leading-snug text-white/50">
                      {task.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
            <p className="mt-4 text-sm text-white/40">
              Վաստակը կլորացվում է ներքև · մակարդակի գործակիցն արդեն հաշվի է
              առնված տոմսի և բուֆետի տողերում
            </p>
          </motion.section>

          <motion.section
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="overflow-hidden rounded-4xl border border-white/10 bg-white/4"
          >
            <div className="border-b border-white/10 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Հրավիրեք ընկերների
                  </h2>
                  <p className="text-base text-white/55">
                    Դուք՝ +{data.referralInviterPoints} · ընկերը՝ +
                    {data.referralInvitedPoints}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              {referralLink ? (
                <>
                  <div className="rounded-2xl border border-dashed border-violet-400/40 bg-violet-500/10 px-4 py-4">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300/70">
                      <Link2 className="h-3.5 w-3.5" />
                      Հրավերի հղում
                    </p>
                    <p className="break-all text-base font-medium text-white/90">
                      {referralLink}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void shareLink()}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-base font-semibold text-white transition hover:opacity-90"
                    >
                      <Share2 className="h-5 w-5" />
                      Ուղարկել
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-base font-semibold text-violet-800 transition hover:bg-violet-50"
                    >
                      {copied ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Copy className="h-5 w-5" />
                      )}
                      {copied ? 'Պատճենված է' : 'Պատճենել'}
                    </button>
                  </div>

                  <p className="text-center text-base text-white/45">
                    {data.referralCount} հրավիրված
                  </p>
                </>
              ) : (
                <p className="text-base text-white/50">
                  Հրավերի հղումը դեռ պատրաստ չէ
                </p>
              )}
            </div>
          </motion.section>
        </div>

        {/* ԱՋ — պարգևներ + պատմություն */}
        <div className="space-y-8">
          <motion.section
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.08 }}
          >
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/40">
                  Պարգևներ
                </p>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  Փոխանակեք միավորները
                </h2>
              </div>
              {affordableCount > 0 && (
                <span className="rounded-full bg-emerald-400/15 px-3.5 py-1.5 text-sm font-semibold text-emerald-300">
                  {affordableCount} հասանելի
                </span>
              )}
            </div>

            {data.rewards.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center text-base text-white/45">
                Պարգևները շուտով հասանելի կլինեն
              </div>
            ) : (
              <div className="grid gap-3">
                {data.rewards.map((reward, index) => {
                  const progress = Math.min(
                    100,
                    Math.round(
                      (data.points / Math.max(1, reward.pointsCost)) * 100
                    )
                  );
                  return (
                    <motion.div
                      key={reward.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.04 }}
                      className={`rounded-3xl border p-5 ${
                        reward.affordable
                          ? 'border-fuchsia-400/35 bg-linear-to-br from-fuchsia-500/15 to-violet-500/10'
                          : 'border-white/10 bg-white/4'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-white">
                            {reward.name}
                          </p>
                          {(reward.description || reward.productName) && (
                            <p className="mt-1 text-sm text-white/50">
                              {reward.description || reward.productName}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-2xl px-3.5 py-2 text-base font-bold tabular-nums ${
                            reward.affordable
                              ? 'bg-white text-violet-700'
                              : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {reward.pointsCost}
                        </span>
                      </div>

                      <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all ${
                            reward.affordable
                              ? 'bg-linear-to-r from-fuchsia-400 to-violet-400'
                              : 'bg-white/30'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-sm text-white/45">
                        {reward.affordable
                          ? 'Պատրաստ է · դրամարկղում ասեք ձեր հեռախոսը'
                          : `Մնացել է ${reward.pointsCost - data.points} միավոր`}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <p className="mt-4 text-center text-sm text-white/35">
              Պարգևը կիրառվում է դրամարկղում՝ ձեր հեռախոսահամարով
            </p>
          </motion.section>

          <motion.section
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.12 }}
          >
            <p className="mb-1 text-sm font-semibold uppercase tracking-[0.18em] text-white/40">
              Պատմություն
            </p>
            <h2 className="mb-5 text-2xl font-bold text-white sm:text-3xl">
              Միավորների շարժ
            </h2>

            {data.history.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center text-base text-white/45">
                Դեռ շարժ չկա — առաջին վճարումից հետո կհայտնվի այստեղ
              </div>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto rounded-4xl border border-white/10 bg-white/3 px-4 py-2 sm:px-5">
                {data.history.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-start gap-4 border-b border-white/5 py-4 last:border-0"
                  >
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                        row.points >= 0
                          ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
                          : 'border-rose-400/40 bg-rose-400/15 text-rose-300'
                      }`}
                    >
                      {row.points >= 0 ? (
                        <Gift className="h-4 w-4" />
                      ) : (
                        <Coins className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-medium text-white">
                            {row.typeLabel}
                          </p>
                          <p className="text-sm text-white/40">
                            {row.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-base font-bold tabular-nums ${
                              row.points >= 0
                                ? 'text-emerald-300'
                                : 'text-rose-300'
                            }`}
                          >
                            {row.points > 0 ? '+' : ''}
                            {row.points}
                          </p>
                          <p className="text-xs text-white/30">
                            {new Date(row.createdAt).toLocaleDateString(
                              'hy-AM'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0614] pb-20 pt-24 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(124,58,237,0.45),transparent)]" />
        <div className="absolute bottom-0 left-1/2 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>
      <div className="relative container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
