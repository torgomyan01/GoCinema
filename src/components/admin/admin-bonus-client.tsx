'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Coins,
  Gift,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  adjustUserBonusPoints,
  deleteBonusReward,
  getAdminBonusOverview,
  getUserBonusLedger,
  recalculateAllBonusBalances,
  saveBonusReward,
  searchBonusMembers,
  updateBonusSettings,
  type AdminBonusOverview,
  type BonusHistoryItem,
} from '@/app/actions/bonus';
import { REWARD_KIND_LABELS_HY, TIER_LABELS_HY } from '@/lib/bonus-labels';

type Tab = 'rules' | 'rewards' | 'members';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'rules', label: 'Կանոններ' },
  { key: 'rewards', label: 'Պարգևներ' },
  { key: 'members', label: 'Անդամներ' },
];

const WEEKDAYS = [
  { value: 1, label: 'Երկ' },
  { value: 2, label: 'Երք' },
  { value: 3, label: 'Չրք' },
  { value: 4, label: 'Հնգ' },
  { value: 5, label: 'Ուրբ' },
  { value: 6, label: 'Շբթ' },
  { value: 0, label: 'Կիր' },
];

interface RewardForm {
  id?: number;
  name: string;
  description: string;
  pointsCost: string;
  kind: 'product' | 'ticket' | 'discount';
  productId: string;
  discountAmount: string;
  isActive: boolean;
  sortOrder: string;
}

const emptyReward: RewardForm = {
  name: '',
  description: '',
  pointsCost: '',
  kind: 'product',
  productId: '',
  discountAmount: '',
  isActive: true,
  sortOrder: '0',
};

type MemberRow = {
  id: number;
  name: string | null;
  phone: string;
  bonusPoints: number;
  bonusTier: string;
  bonusVisits: number;
};

export default function AdminBonusClient() {
  const [tab, setTab] = useState<Tab>('rules');
  const [data, setData] = useState<AdminBonusOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Կանոնների ձև
  const [form, setForm] = useState({
    isActive: true,
    amountPerPoint: '100',
    ticketMultiplier: '1',
    productMultiplier: '1.5',
    welcomePoints: '50',
    birthdayPoints: '100',
    referralInviterPoints: '100',
    referralInvitedPoints: '50',
    bonusWeekdays: [2, 3] as number[],
    bonusDayMultiplier: '2',
    goldVisits: '8',
    platinumVisits: '15',
    goldMultiplier: '1.25',
    platinumMultiplier: '1.5',
  });

  // Պարգևի մոդալ
  const [rewardModal, setRewardModal] = useState<RewardForm | null>(null);

  // Անդամներ
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [ledgerUser, setLedgerUser] = useState<MemberRow | null>(null);
  const [ledger, setLedger] = useState<BonusHistoryItem[]>([]);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getAdminBonusOverview();
    if (!result.success || !result.data) {
      setError(result.error ?? 'Բեռնման սխալ');
      setLoading(false);
      return;
    }
    setError(null);
    setData(result.data);
    const s = result.data.settings;
    setForm({
      isActive: s.isActive,
      amountPerPoint: String(s.amountPerPoint),
      ticketMultiplier: String(s.ticketMultiplier),
      productMultiplier: String(s.productMultiplier),
      welcomePoints: String(s.welcomePoints),
      birthdayPoints: String(s.birthdayPoints),
      referralInviterPoints: String(s.referralInviterPoints),
      referralInvitedPoints: String(s.referralInvitedPoints),
      bonusWeekdays: s.bonusWeekdays
        .split(',')
        .map((d) => Number(d.trim()))
        .filter((d) => Number.isInteger(d)),
      bonusDayMultiplier: String(s.bonusDayMultiplier),
      goldVisits: String(s.goldVisits),
      platinumVisits: String(s.platinumVisits),
      goldMultiplier: String(s.goldMultiplier),
      platinumMultiplier: String(s.platinumMultiplier),
    });
    setMembers(
      result.data.topMembers.map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        bonusPoints: m.points,
        bonusTier: m.tier,
        bonusVisits: m.visits,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const saveRules = async () => {
    setSaving(true);
    const result = await updateBonusSettings({
      isActive: form.isActive,
      amountPerPoint: Number(form.amountPerPoint),
      ticketMultiplier: Number(form.ticketMultiplier),
      productMultiplier: Number(form.productMultiplier),
      welcomePoints: Number(form.welcomePoints),
      birthdayPoints: Number(form.birthdayPoints),
      referralInviterPoints: Number(form.referralInviterPoints),
      referralInvitedPoints: Number(form.referralInvitedPoints),
      bonusWeekdays: form.bonusWeekdays,
      bonusDayMultiplier: Number(form.bonusDayMultiplier),
      goldVisits: Number(form.goldVisits),
      platinumVisits: Number(form.platinumVisits),
      goldMultiplier: Number(form.goldMultiplier),
      platinumMultiplier: Number(form.platinumMultiplier),
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Սխալ');
      return;
    }
    setError(null);
    flash(result.message ?? 'Պահպանված է');
    load();
  };

  const submitReward = async () => {
    if (!rewardModal) return;
    setSaving(true);
    const result = await saveBonusReward({
      id: rewardModal.id,
      name: rewardModal.name,
      description: rewardModal.description,
      pointsCost: Number(rewardModal.pointsCost),
      kind: rewardModal.kind,
      productId: rewardModal.productId ? Number(rewardModal.productId) : null,
      discountAmount: Number(rewardModal.discountAmount || 0),
      isActive: rewardModal.isActive,
      sortOrder: Number(rewardModal.sortOrder || 0),
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Սխալ');
      return;
    }
    setError(null);
    setRewardModal(null);
    flash(result.message ?? 'Պահպանված է');
    load();
  };

  const removeReward = async (id: number, name: string) => {
    if (!confirm(`Ջնջե՞լ «${name}» պարգևը`)) return;
    const result = await deleteBonusReward(id);
    if (!result.success) {
      setError(result.error ?? 'Սխալ');
      return;
    }
    flash(result.message ?? 'Ջնջված է');
    load();
  };

  const runSearch = async () => {
    setSearching(true);
    const result = await searchBonusMembers(query);
    setSearching(false);
    if (!result.success) {
      setError(result.error ?? 'Որոնման սխալ');
      return;
    }
    setMembers(result.users as MemberRow[]);
  };

  const openLedger = async (member: MemberRow) => {
    setLedgerUser(member);
    setLedger([]);
    setAdjustPoints('');
    setAdjustNote('');
    const result = await getUserBonusLedger(member.id);
    if (result.success) setLedger(result.rows);
  };

  const submitAdjust = async () => {
    if (!ledgerUser) return;
    setSaving(true);
    const result = await adjustUserBonusPoints({
      userId: ledgerUser.id,
      points: Number(adjustPoints),
      note: adjustNote,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Սխալ');
      return;
    }
    setError(null);
    flash(result.message ?? 'Կիրառված է');
    setLedgerUser(null);
    load();
  };

  const recalc = async () => {
    setSaving(true);
    const result = await recalculateAllBonusBalances();
    setSaving(false);
    if (result.success) flash(result.message ?? 'Վերահաշվարկված է');
    else setError(result.error ?? 'Սխալ');
    load();
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-100 p-2">
              <Gift className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Բոնուսային համակարգ
              </h1>
              <p className="text-sm text-gray-600">
                Միավորների կանոններ, պարգևների կատալոգ և անդամների մնացորդներ
              </p>
            </div>
          </div>
          <button
            onClick={recalc}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Վերահաշվարկել մնացորդները
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {/* Ամփոփ ցուցանիշներ */}
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Users className="h-4 w-4 text-violet-600" />}
              label="Ակտիվ անդամ"
              value={data.stats.members.toLocaleString('hy-AM')}
            />
            <StatCard
              icon={<Coins className="h-4 w-4 text-amber-600" />}
              label="Չծախսված միավոր"
              value={data.stats.totalOutstanding.toLocaleString('hy-AM')}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
              label="Ընդհանուր վաստակած"
              value={data.stats.earnedTotal.toLocaleString('hy-AM')}
            />
            <StatCard
              icon={<Gift className="h-4 w-4 text-rose-600" />}
              label="Ընդհանուր ծախսած"
              value={data.stats.redeemedTotal.toLocaleString('hy-AM')}
            />
          </div>
        )}

        {/* Ներդիրներ */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                tab === item.key
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'rules' && (
          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-violet-600"
              />
              <span className="text-sm font-semibold text-gray-900">
                Համակարգը միացված է
              </span>
            </label>

            <Section title="Վաստակ" icon={<Coins className="h-4 w-4" />}>
              <NumberField
                label="Քանի դրամի դիմաց 1 միավոր"
                value={form.amountPerPoint}
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, amountPerPoint: v }))
                }
              />
              <NumberField
                label="Տոմսի գործակից"
                value={form.ticketMultiplier}
                step="0.1"
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, ticketMultiplier: v }))
                }
              />
              <NumberField
                label="Ապրանքի գործակից"
                value={form.productMultiplier}
                step="0.1"
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, productMultiplier: v }))
                }
              />
            </Section>

            <Section title="Միանվագ բոնուսներ" icon={<Gift className="h-4 w-4" />}>
              <NumberField
                label="Ողջույնի բոնուս"
                value={form.welcomePoints}
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, welcomePoints: v }))
                }
              />
              <NumberField
                label="Ծննդյան բոնուս"
                value={form.birthdayPoints}
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, birthdayPoints: v }))
                }
              />
              <NumberField
                label="Հրավիրողին"
                value={form.referralInviterPoints}
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, referralInviterPoints: v }))
                }
              />
              <NumberField
                label="Հրավիրվածին"
                value={form.referralInvitedPoints}
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, referralInvitedPoints: v }))
                }
              />
            </Section>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Settings2 className="h-4 w-4" />
                Բոնուսային օրեր
              </p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const active = form.bonusWeekdays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          bonusWeekdays: active
                            ? prev.bonusWeekdays.filter((d) => d !== day.value)
                            : [...prev.bonusWeekdays, day.value],
                        }))
                      }
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 max-w-xs">
                <NumberField
                  label="Բոնուսային օրվա գործակից"
                  value={form.bonusDayMultiplier}
                  step="0.1"
                  onChange={(v) =>
                    setForm((prev) => ({ ...prev, bonusDayMultiplier: v }))
                  }
                />
              </div>
            </div>

            <Section title="Մակարդակներ" icon={<TrendingUp className="h-4 w-4" />}>
              <NumberField
                label="Ոսկի՝ այցերից"
                value={form.goldVisits}
                onChange={(v) => setForm((prev) => ({ ...prev, goldVisits: v }))}
              />
              <NumberField
                label="Ոսկու գործակից"
                value={form.goldMultiplier}
                step="0.05"
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, goldMultiplier: v }))
                }
              />
              <NumberField
                label="Պլատին՝ այցերից"
                value={form.platinumVisits}
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, platinumVisits: v }))
                }
              />
              <NumberField
                label="Պլատինի գործակից"
                value={form.platinumMultiplier}
                step="0.05"
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, platinumMultiplier: v }))
                }
              />
            </Section>

            <button
              onClick={saveRules}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Պահպանել կանոնները
            </button>
          </div>
        )}

        {tab === 'rewards' && data && (
          <div className="space-y-4">
            <button
              onClick={() => setRewardModal({ ...emptyReward })}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Ավելացնել պարգև
            </button>

            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Պարգև</th>
                    <th className="px-4 py-3">Տիպ</th>
                    <th className="px-4 py-3 text-right">Միավոր</th>
                    <th className="px-4 py-3 text-right">Օգտագործված</th>
                    <th className="px-4 py-3">Կարգավիճակ</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.rewards.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        Պարգևներ դեռ չկան
                      </td>
                    </tr>
                  ) : (
                    data.rewards.map((reward) => (
                      <tr key={reward.id} className="border-t border-gray-100">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {reward.name}
                          </p>
                          {reward.productName && (
                            <p className="text-xs text-gray-500">
                              {reward.productName}
                            </p>
                          )}
                          {reward.kind === 'discount' && (
                            <p className="text-xs text-gray-500">
                              Զեղչ՝ {reward.discountAmount} ֏
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {REWARD_KIND_LABELS_HY[reward.kind] ?? reward.kind}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-violet-700">
                          {reward.pointsCost}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                          {reward.redeemedCount}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              reward.isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {reward.isActive ? 'Ակտիվ' : 'Անջատված'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() =>
                                setRewardModal({
                                  id: reward.id,
                                  name: reward.name,
                                  description: reward.description ?? '',
                                  pointsCost: String(reward.pointsCost),
                                  kind: reward.kind as RewardForm['kind'],
                                  productId: reward.productId
                                    ? String(reward.productId)
                                    : '',
                                  discountAmount: String(reward.discountAmount),
                                  isActive: reward.isActive,
                                  sortOrder: String(reward.sortOrder),
                                })
                              }
                              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                              title="Խմբագրել"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => removeReward(reward.id, reward.name)}
                              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                              title="Ջնջել"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'members' && data && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  placeholder="Անուն կամ հեռախոս"
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <button
                onClick={runSearch}
                disabled={searching}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                Որոնել
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Հաճախորդ</th>
                    <th className="px-4 py-3">Մակարդակ</th>
                    <th className="px-4 py-3 text-right">Այցեր</th>
                    <th className="px-4 py-3 text-right">Միավոր</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        Արդյունք չկա
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr key={member.id} className="border-t border-gray-100">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {member.name || 'Անանուն'}
                          </p>
                          <p className="text-xs text-gray-500">{member.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {TIER_LABELS_HY[member.bonusTier] ?? member.bonusTier}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                          {member.bonusVisits}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-violet-700">
                          {member.bonusPoints}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openLedger(member)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                          >
                            Պատմություն / ճշգրտում
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                Վերջին շարժերը
              </h2>
              <div className="space-y-2">
                {data.recent.length === 0 ? (
                  <p className="text-sm text-gray-500">Շարժ դեռ չկա</p>
                ) : (
                  data.recent.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 border-b border-gray-50 pb-2 text-sm last:border-0"
                    >
                      <div>
                        <p className="text-gray-900">{row.typeLabel}</p>
                        <p className="text-xs text-gray-500">
                          {row.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold tabular-nums ${
                            row.points >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {row.points > 0 ? '+' : ''}
                          {row.points}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(row.createdAt).toLocaleString('hy-AM')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Պարգևի մոդալ */}
      {rewardModal && data && (
        <Modal
          title={rewardModal.id ? 'Խմբագրել պարգևը' : 'Նոր պարգև'}
          onClose={() => setRewardModal(null)}
        >
          <div className="space-y-4">
            <TextField
              label="Անվանում"
              value={rewardModal.name}
              onChange={(v) =>
                setRewardModal((prev) => prev && { ...prev, name: v })
              }
            />
            <TextField
              label="Նկարագրություն"
              value={rewardModal.description}
              onChange={(v) =>
                setRewardModal((prev) => prev && { ...prev, description: v })
              }
            />
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">Տիպ</p>
              <select
                value={rewardModal.kind}
                onChange={(e) =>
                  setRewardModal(
                    (prev) =>
                      prev && {
                        ...prev,
                        kind: e.target.value as RewardForm['kind'],
                      }
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              >
                {Object.entries(REWARD_KIND_LABELS_HY).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {rewardModal.kind === 'product' && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">
                  Ապրանք
                </p>
                <select
                  value={rewardModal.productId}
                  onChange={(e) =>
                    setRewardModal(
                      (prev) => prev && { ...prev, productId: e.target.value }
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                >
                  <option value="">— Ընտրել —</option>
                  {data.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.price} ֏)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {rewardModal.kind === 'discount' && (
              <NumberField
                label="Զեղչի գումար (֏)"
                value={rewardModal.discountAmount}
                onChange={(v) =>
                  setRewardModal((prev) => prev && { ...prev, discountAmount: v })
                }
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Արժեք միավորներով"
                value={rewardModal.pointsCost}
                onChange={(v) =>
                  setRewardModal((prev) => prev && { ...prev, pointsCost: v })
                }
              />
              <NumberField
                label="Դասավորություն"
                value={rewardModal.sortOrder}
                onChange={(v) =>
                  setRewardModal((prev) => prev && { ...prev, sortOrder: v })
                }
              />
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={rewardModal.isActive}
                onChange={(e) =>
                  setRewardModal(
                    (prev) => prev && { ...prev, isActive: e.target.checked }
                  )
                }
                className="h-4 w-4 rounded border-gray-300 text-violet-600"
              />
              <span className="text-sm text-gray-700">Ակտիվ</span>
            </label>

            <button
              onClick={submitReward}
              disabled={saving}
              className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              Պահպանել
            </button>
          </div>
        </Modal>
      )}

      {/* Օգտատիրոջ պատմություն + ճշգրտում */}
      {ledgerUser && (
        <Modal
          title={`${ledgerUser.name || 'Անանուն'} · ${ledgerUser.phone}`}
          onClose={() => setLedgerUser(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs text-violet-700">Ընթացիկ մնացորդ</p>
              <p className="text-2xl font-bold text-violet-900">
                {ledgerUser.bonusPoints}
              </p>
              <p className="text-xs text-violet-700">
                {TIER_LABELS_HY[ledgerUser.bonusTier] ?? ledgerUser.bonusTier} ·{' '}
                {ledgerUser.bonusVisits} այց
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <NumberField
                label="Միավոր (+ / −)"
                value={adjustPoints}
                onChange={setAdjustPoints}
              />
              <TextField
                label="Պատճառ"
                value={adjustNote}
                onChange={setAdjustNote}
              />
            </div>
            <button
              onClick={submitAdjust}
              disabled={saving}
              className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              Կիրառել ճշգրտումը
            </button>

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {ledger.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 border-b border-gray-50 pb-2 text-sm last:border-0"
                >
                  <div>
                    <p className="text-gray-900">{row.typeLabel}</p>
                    <p className="text-xs text-gray-500">{row.description}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold tabular-nums ${
                        row.points >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {row.points > 0 ? '+' : ''}
                      {row.points}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(row.createdAt).toLocaleDateString('hy-AM')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
        {icon}
        {title}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-gray-500">{label}</p>
      <input
        type="number"
        step={step ?? '1'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-gray-500">{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
      />
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
