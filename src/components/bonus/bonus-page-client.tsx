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
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';
import {
  getMyBonus,
  redeemReferralCode,
  type MyBonusData,
} from '@/app/actions/bonus';
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
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

export default function BonusPageClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [data, setData] = useState<MyBonusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  const [codeOk, setCodeOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const copyCode = async () => {
    if (!data?.referralCode) return;
    await navigator.clipboard.writeText(data.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitCode = async () => {
    setSubmitting(true);
    setCodeMessage(null);
    const result = await redeemReferralCode(code);
    setSubmitting(false);
    if (!result.success) {
      setCodeOk(false);
      setCodeMessage(result.error ?? 'Կոդը վավեր չէ');
      return;
    }
    setCodeOk(true);
    setCodeMessage(result.message ?? 'Կոդն ընդունված է');
    setCode('');
    void load();
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.35),_transparent_55%)]" />
        <Loader2 className="relative h-8 w-8 animate-spin text-violet-300" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-6 py-8 text-center text-rose-100 backdrop-blur">
          {error ?? 'Տվյալները հասանելի չեն'}
        </div>
      </Shell>
    );
  }

  if (!data.isActive) {
    return (
      <Shell>
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center backdrop-blur">
          <Gift className="mx-auto mb-3 h-10 w-10 text-white/30" />
          <p className="text-white/70">
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

  return (
    <Shell>
      <div className="mb-6">
        <Link
          href={SITE_URL.ACCOUNT}
          className="inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Հաշիվ
        </Link>
      </div>

      {/* Hero — միավորներ */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.45 }}
        className="relative mb-8 overflow-hidden rounded-[2rem] border border-white/10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#5b21b6] via-[#7c3aed] to-[#db2777]" />
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
        <div
          className={`absolute right-8 top-8 h-24 w-24 rounded-full blur-2xl ${tier.glow}`}
        />

        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                GoCinema Bonus
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Իմ բոնուսները
              </h1>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${tier.accent} px-3.5 py-1.5 text-xs font-bold text-white shadow-lg`}
            >
              <Crown className="h-3.5 w-3.5" />
              {TIER_LABELS_HY[data.tier] ?? tier.label}
            </span>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 flex items-center gap-2 text-sm text-white/70">
                <Coins className="h-4 w-4" />
                Հասանելի միավորներ
              </p>
              <motion.p
                key={data.points}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-5xl font-bold tabular-nums tracking-tight text-white sm:text-6xl"
              >
                {data.points.toLocaleString('hy-AM')}
              </motion.p>
              <p className="mt-2 max-w-md text-sm text-white/65">
                Ամեն {data.amountPerPoint} ֏ գնումից՝ միավորներ
                {data.earnMultiplier > 1
                  ? ` · ձեր մակարդակով ×${data.earnMultiplier}`
                  : ''}
              </p>
            </div>

            <div className="w-full max-w-xs rounded-2xl border border-white/15 bg-black/20 p-4 backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between text-xs text-white/70">
                <span>{data.visits} այց</span>
                {data.nextTier ? (
                  <span>
                    {TIER_LABELS_HY[data.nextTier]} · մնացել է{' '}
                    {data.visitsToNextTier}
                  </span>
                ) : (
                  <span>Առավելագույն մակարդակ</span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${tierProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${tier.bar}`}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Ինչպես վաստակել — մեկ շարք */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.45, delay: 0.06 }}
        className="mb-8"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          Ինչպես վաստակել
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <EarnChip
            icon={<Ticket className="h-4 w-4" />}
            title="Տոմս և բուֆետ"
            text={`Ամեն ${data.amountPerPoint} ֏ · բուֆետը՝ ավելի շատ`}
          />
          {bonusDayLabels ? (
            <EarnChip
              icon={<CalendarDays className="h-4 w-4" />}
              title={`×${data.bonusDayMultiplier} բոնուսային օր`}
              text={bonusDayLabels}
            />
          ) : (
            <EarnChip
              icon={<CalendarDays className="h-4 w-4" />}
              title="Բոնուսային օրեր"
              text="Հատուկ օրերին՝ ավելի շատ միավոր"
            />
          )}
          <EarnChip
            icon={<TrendingUp className="h-4 w-4" />}
            title="Մակարդակներ"
            text="Որքան շատ այց, այնքան բարձր գործակից"
          />
        </div>
      </motion.section>

      {/* Պարգևներ */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="mb-8"
      >
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Պարգևներ
            </p>
            <h2 className="text-xl font-bold text-white">Փոխանակեք միավորները</h2>
          </div>
          {affordableCount > 0 && (
            <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
              {affordableCount} հասանելի
            </span>
          )}
        </div>

        {data.rewards.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-white/45">
            Պարգևները շուտով հասանելի կլինեն
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.rewards.map((reward, index) => {
              const progress = Math.min(
                100,
                Math.round((data.points / Math.max(1, reward.pointsCost)) * 100)
              );
              return (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + index * 0.04 }}
                  className={`group relative overflow-hidden rounded-3xl border p-5 transition ${
                    reward.affordable
                      ? 'border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/15 to-violet-500/10'
                      : 'border-white/10 bg-white/[0.04]'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{reward.name}</p>
                      {(reward.description || reward.productName) && (
                        <p className="mt-1 text-xs text-white/50">
                          {reward.description || reward.productName}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-2xl px-3 py-1.5 text-sm font-bold tabular-nums ${
                        reward.affordable
                          ? 'bg-white text-violet-700'
                          : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {reward.pointsCost}
                    </span>
                  </div>

                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        reward.affordable
                          ? 'bg-gradient-to-r from-fuchsia-400 to-violet-400'
                          : 'bg-white/30'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/45">
                    {reward.affordable
                      ? 'Պատրաստ է · դրամարկղում ասեք ձեր հեռախոսը'
                      : `Մնացել է ${reward.pointsCost - data.points} միավոր`}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-white/35">
          Պարգևը կիրառվում է դրամարկղում՝ ձեր հեռախոսահամարով
        </p>
      </motion.section>

      {/* Հրավեր */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.45, delay: 0.14 }}
        className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]"
      >
        <div className="border-b border-white/10 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Հրավիրեք ընկերների</h2>
              <p className="text-sm text-white/50">
                Դուք՝ +{data.referralInviterPoints} · ընկերը՝ +
                {data.referralInvitedPoints} միավոր
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5 sm:px-8">
          {data.referralCode && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 rounded-2xl border border-dashed border-violet-400/40 bg-violet-500/10 px-4 py-3 text-center">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/70">
                  Ձեր կոդը
                </p>
                <code className="text-2xl font-bold tracking-[0.2em] text-white">
                  {data.referralCode}
                </code>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-violet-800 transition hover:bg-violet-50"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Պատճենված է' : 'Պատճենել'}
              </button>
              <p className="text-center text-sm text-white/45 sm:text-left">
                {data.referralCount} հրավիրված
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm text-white/60">Ունե՞ք ընկերոջ կոդ</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GCXXXXXX"
                className="flex-1 rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              <button
                type="button"
                onClick={submitCode}
                disabled={submitting || !code.trim()}
                className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? '…' : 'Կիրառել'}
              </button>
            </div>
            {codeMessage && (
              <p
                className={`mt-2 text-sm ${
                  codeOk ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {codeMessage}
              </p>
            )}
          </div>
        </div>
      </motion.section>

      {/* Պատմություն */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.45, delay: 0.18 }}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          Պատմություն
        </p>
        <h2 className="mb-4 text-xl font-bold text-white">Միավորների շարժ</h2>

        {data.history.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-white/45">
            Դեռ շարժ չկա — առաջին վճարումից հետո կհայտնվի այստեղ
          </div>
        ) : (
          <div className="relative space-y-0 rounded-[2rem] border border-white/10 bg-white/[0.03] px-5 py-2 sm:px-6">
            <div className="absolute bottom-6 left-[1.65rem] top-6 w-px bg-gradient-to-b from-violet-400/50 via-white/10 to-transparent sm:left-[1.9rem]" />
            {data.history.map((row) => (
              <div
                key={row.id}
                className="relative flex items-start gap-4 border-b border-white/5 py-4 last:border-0"
              >
                <div
                  className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                    row.points >= 0
                      ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
                      : 'border-rose-400/40 bg-rose-400/15 text-rose-300'
                  }`}
                >
                  {row.points >= 0 ? (
                    <Gift className="h-3.5 w-3.5" />
                  ) : (
                    <Coins className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {row.typeLabel}
                      </p>
                      <p className="text-xs text-white/40">{row.description}</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          row.points >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {row.points > 0 ? '+' : ''}
                        {row.points}
                      </p>
                      <p className="text-[11px] text-white/30">
                        {new Date(row.createdAt).toLocaleDateString('hy-AM')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0614] pb-24 pt-24 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,_rgba(124,58,237,0.45),_transparent)]" />
        <div className="absolute bottom-0 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>
      <div className="relative container mx-auto max-w-3xl px-4">{children}</div>
    </div>
  );
}

function EarnChip({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.07]">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
        {icon}
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/45">{text}</p>
    </div>
  );
}
