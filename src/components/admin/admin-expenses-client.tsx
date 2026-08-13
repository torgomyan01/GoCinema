'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Download,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  TrendingUp,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import {
  createExpense,
  deleteExpense,
  getExpenses,
  updateExpense,
} from '@/app/actions/expenses';
import {
  EXPENSE_CATEGORY_GROUPS,
  expenseCategoryHint,
  expenseCategoryLabel,
  expenseReducesTurnoverTax,
  type ExpensesResult,
  type ExpenseRow,
} from '@/lib/expenses';

type PresetKey =
  | 'today'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'last30'
  | 'custom';

const PRESET_LABELS: Record<Exclude<PresetKey, 'custom'>, string> = {
  today: 'Այսօր',
  thisWeek: 'Այս շաբաթ',
  lastWeek: 'Անցած շաբաթ',
  thisMonth: 'Այս ամիս',
  last30: 'Վերջին 30 օր',
};

function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const dayFromMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayFromMonday);
  return date;
}

function presetRange(preset: PresetKey): { from: string; to: string } {
  const now = new Date();
  if (preset === 'today') {
    const key = toInputDate(now);
    return { from: key, to: key };
  }
  if (preset === 'thisWeek') {
    const from = startOfWeek(now);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return { from: toInputDate(from), to: toInputDate(to) };
  }
  if (preset === 'lastWeek') {
    const from = startOfWeek(now);
    from.setDate(from.getDate() - 7);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return { from: toInputDate(from), to: toInputDate(to) };
  }
  if (preset === 'thisMonth') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toInputDate(from), to: toInputDate(to) };
  }
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { from: toInputDate(from), to: toInputDate(to) };
}

function formatAmd(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

function formatDayLabel(value: string | Date): string {
  return new Date(value).toLocaleDateString('hy-AM', {
    day: '2-digit',
    month: 'short',
  });
}

function categoryLabel(category: string): string {
  return expenseCategoryLabel(category);
}

interface FormState {
  id: number | null;
  title: string;
  amount: string;
  category: string;
  spentBy: string;
  expenseDate: string;
  note: string;
}

function emptyForm(): FormState {
  return {
    id: null,
    title: '',
    amount: '',
    category: 'other',
    spentBy: '',
    expenseDate: toInputDate(new Date()),
    note: '',
  };
}

export default function AdminExpensesClient() {
  const [preset, setPreset] = useState<PresetKey>('thisMonth');
  const initialRange = presetRange('thisMonth');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState('');

  const [data, setData] = useState<ExpensesResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getExpenses({
        from,
        to,
        category: categoryFilter,
        spentBy: personFilter,
      });
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Բեռնելիս սխալ է տեղի ունեցել');
        setData(null);
      }
    } catch (err) {
      console.error('[Expenses] load error:', err);
      setError('Բեռնելիս սխալ է տեղի ունեցել');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [from, to, categoryFilter, personFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (key: Exclude<PresetKey, 'custom'>) => {
    const range = presetRange(key);
    setPreset(key);
    setFrom(range.from);
    setTo(range.to);
  };

  const openAdd = () => {
    setForm(emptyForm());
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (row: ExpenseRow) => {
    setForm({
      id: row.id,
      title: row.title,
      amount: String(row.amount),
      category: row.category,
      spentBy: row.spentBy,
      expenseDate: toInputDate(new Date(row.expenseDate)),
      note: row.note || '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title,
        amount: Number(form.amount),
        category: form.category,
        spentBy: form.spentBy,
        note: form.note,
        expenseDate: form.expenseDate,
      };
      const result = form.id
        ? await updateExpense({ ...payload, id: form.id })
        : await createExpense(payload);
      if (result.success) {
        setShowForm(false);
        setForm(emptyForm());
        await load();
      } else {
        setFormError(result.error || 'Պահպանելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('[Expenses] save error:', err);
      setFormError('Պահպանելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Վստա՞հ եք, որ ուզում եք ջնջել այս ծախսը։')) return;
    setDeletingId(id);
    try {
      const result = await deleteExpense(id);
      if (result.success) {
        await load();
      } else {
        alert(result.error || 'Ջնջելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('[Expenses] delete error:', err);
      alert('Ջնջելիս սխալ է տեղի ունեցել');
    } finally {
      setDeletingId(null);
    }
  };

  const exportCsv = () => {
    if (!data || data.rows.length === 0) return;
    const header = [
      'Ամսաթիվ',
      'Անվանում',
      'Կատեգորիա',
      'Ծախս վերցնող',
      'Գումար',
      'Նշում',
    ];
    const lines = data.rows.map((r) =>
      [
        toInputDate(new Date(r.expenseDate)),
        r.title,
        categoryLabel(r.category),
        r.spentBy,
        String(Math.round(r.amount)),
        r.note || '',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = '\uFEFF' + [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const analytics = data?.analytics;
  const maxDaily = useMemo(
    () => Math.max(1, ...(analytics?.daily.map((d) => d.total) ?? [1])),
    [analytics]
  );
  const maxWeekly = useMemo(
    () => Math.max(1, ...(analytics?.weekly.map((w) => w.total) ?? [1])),
    [analytics]
  );
  const maxCategory = useMemo(
    () => Math.max(1, ...(analytics?.byCategory.map((c) => c.total) ?? [1])),
    [analytics]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-100 p-2">
              <Wallet className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ծախսեր</h1>
              <p className="text-sm text-gray-600">
                Օրվա ծախսերի հաշվառում, ֆիլտր և անալիտիկա
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={!data || data.rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500"
            >
              <Plus className="h-4 w-4" />
              Ավելացնել ծախս
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">
                Ժամանակահատված
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  Object.keys(PRESET_LABELS) as Array<
                    Exclude<PresetKey, 'custom'>
                  >
                ).map((key) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      preset === key
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {PRESET_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">
                  Սկիզբ
                </p>
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => {
                    setPreset('custom');
                    setFrom(e.target.value);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">
                  Ավարտ
                </p>
                <input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => {
                    setPreset('custom');
                    setTo(e.target.value);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">
                  Կատեգորիա
                </p>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="all">Բոլորը</option>
                  {EXPENSE_CATEGORY_GROUPS.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                      {group.items.map((c) => (
                        <option key={c} value={c}>
                          {categoryLabel(c)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="min-w-[180px] flex-1">
                <p className="mb-1.5 text-xs font-medium text-gray-500">
                  Ծախս վերցնող
                </p>
                <input
                  type="text"
                  value={personFilter}
                  onChange={(e) => setPersonFilter(e.target.value)}
                  placeholder="Անուն..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setPersonFilter('');
                  applyPreset('thisMonth');
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                Զրոյացնել
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Բեռնվում է...
          </div>
        ) : analytics ? (
          <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={<Wallet className="w-5 h-5" />}
              label="Ընդհանուր ծախս"
              value={formatAmd(analytics.total)}
              accent="text-rose-600 bg-rose-50"
            />
            <SummaryCard
              icon={<Receipt className="w-5 h-5" />}
              label="Գրառումների քանակ"
              value={String(analytics.count)}
              accent="text-indigo-600 bg-indigo-50"
            />
            <SummaryCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Միջին օրական"
              value={formatAmd(analytics.averagePerDay)}
              accent="text-amber-600 bg-amber-50"
            />
            <SummaryCard
              icon={<CalendarDays className="w-5 h-5" />}
              label="Ակտիվ օրեր"
              value={String(analytics.daysCount)}
              accent="text-emerald-600 bg-emerald-50"
            />
          </div>

          {/* Daily chart */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-rose-600" />
              Օրական ծախսեր
            </h2>
            {analytics.daily.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">
                Տվյալ չկա
              </p>
            ) : (
              <div className="flex items-end gap-2 overflow-x-auto pb-2">
                {analytics.daily.map((d) => {
                  const heightPct = Math.max(
                    (d.total / maxDaily) * 100,
                    d.total > 0 ? 6 : 2
                  );
                  return (
                    <div
                      key={d.dateKey}
                      className="flex min-w-[48px] flex-1 flex-col items-center gap-2"
                      title={`${formatDayLabel(d.dateKey)}: ${formatAmd(d.total)}`}
                    >
                      <span className="text-[10px] font-medium text-gray-500">
                        {formatAmd(d.total)}
                      </span>
                      <div className="flex h-32 w-full items-end justify-center">
                        <div
                          className="w-7 rounded-t-lg bg-linear-to-t from-rose-500 to-rose-400"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {formatDayLabel(d.dateKey)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly + Category */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
                Շաբաթական ծախսեր
              </h2>
              {analytics.weekly.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  Տվյալ չկա
                </p>
              ) : (
                <div className="flex items-end gap-3 overflow-x-auto pb-2">
                  {analytics.weekly.map((w) => {
                    const heightPct = Math.max(
                      (w.total / maxWeekly) * 100,
                      w.total > 0 ? 6 : 2
                    );
                    return (
                      <div
                        key={w.weekStart}
                        className="flex min-w-[64px] flex-1 flex-col items-center gap-2"
                        title={`${formatDayLabel(w.weekStart)}: ${formatAmd(w.total)}`}
                      >
                        <span className="text-[10px] font-medium text-gray-500">
                          {formatAmd(w.total)}
                        </span>
                        <div className="flex h-28 w-full items-end justify-center">
                          <div
                            className="w-9 rounded-t-lg bg-linear-to-t from-indigo-500 to-indigo-400"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {formatDayLabel(w.weekStart)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" />
                Ըստ կատեգորիայի
              </h2>
              {analytics.byCategory.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  Տվյալ չկա
                </p>
              ) : (
                <div className="space-y-3">
                  {analytics.byCategory.map((c) => (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">
                          {categoryLabel(c.category)}
                          <span className="text-gray-400 ml-1">
                            ({c.count})
                          </span>
                        </span>
                        <span className="font-semibold text-gray-900">
                          {formatAmd(c.total)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-amber-500 to-amber-400"
                          style={{ width: `${(c.total / maxCategory) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* By person */}
          {analytics.byPerson.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-emerald-600" />
                Ըստ ծախս վերցնողի
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {analytics.byPerson.map((p) => (
                  <div
                    key={p.spentBy}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold shrink-0">
                        {p.spentBy.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {p.spentBy}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {p.count} գրառում
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">
                      {formatAmd(p.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                Ծախսերի ցանկ ({data?.rows.length ?? 0})
              </h2>
            </div>
            {data && data.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left font-medium px-4 py-3">
                        Ամսաթիվ
                      </th>
                      <th className="text-left font-medium px-4 py-3">
                        Անվանում
                      </th>
                      <th className="text-left font-medium px-4 py-3">
                        Կատեգորիա
                      </th>
                      <th className="text-left font-medium px-4 py-3">
                        Ծախս վերցնող
                      </th>
                      <th className="text-right font-medium px-4 py-3">
                        Գումար
                      </th>
                      <th className="text-right font-medium px-4 py-3">
                        Գործողություն
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                          {formatDayLabel(r.expenseDate)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{r.title}</p>
                          {r.note && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {r.note}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                            {categoryLabel(r.category)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.spentBy}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {formatAmd(r.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(r)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                              title="Խմբագրել"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              disabled={deletingId === r.id}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Ջնջել"
                            >
                              {deletingId === r.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-12 text-center">
                Այս ժամանակահատվածում ծախսեր չկան
              </p>
            )}
          </div>
          </div>
        ) : null}

        {/* Add/Edit modal */}
        {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {form.id ? 'Խմբագրել ծախսը' : 'Ավելացնել ծախս'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Անվանում <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Օր.՝ Էլեկտրաէներգիա"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Գումար (֏) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ամսաթիվ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) =>
                      setForm({ ...form, expenseDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Կատեգորիա
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {EXPENSE_CATEGORY_GROUPS.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                      {group.items.map((c) => (
                        <option key={c} value={c}>
                          {categoryLabel(c)}
                          {expenseReducesTurnoverTax(c)
                            ? ''
                            : ' — չի նվազեցնում շրջհարկը'}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-500">
                  {expenseCategoryHint(form.category)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ծախս վերցնողի անունը <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.spentBy}
                  onChange={(e) =>
                    setForm({ ...form, spentBy: e.target.value })
                  }
                  placeholder="Օր.՝ Արամ Ս."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Նշում
                </label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  placeholder="Լրացուցիչ մանրամասներ (ոչ պարտադիր)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                Չեղարկել
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {form.id ? 'Պահպանել' : 'Ավելացնել'}
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="truncate text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
