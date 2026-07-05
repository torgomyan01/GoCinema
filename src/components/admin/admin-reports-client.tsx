'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Armchair,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Film,
  Loader2,
  Printer,
  RotateCcw,
  Ticket as TicketIcon,
  TrendingUp,
  UserX,
  XCircle,
  ShoppingCart,
} from 'lucide-react';
import {
  getMovieReports,
  type MovieReportData,
  type ReportBasis,
} from '@/app/actions/reports';

type PresetKey =
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'last30'
  | 'custom';

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
  // last30
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { from: toInputDate(from), to: toInputDate(to) };
}

const PRESET_LABELS: Record<Exclude<PresetKey, 'custom'>, string> = {
  thisWeek: 'Այս շաբաթ',
  lastWeek: 'Անցած շաբաթ',
  thisMonth: 'Այս ամիս',
  last30: 'Վերջին 30 օր',
};

function formatAmd(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDayLabel(value: string | Date): string {
  return new Date(value).toLocaleDateString('hy-AM', {
    day: '2-digit',
    month: 'short',
  });
}

function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('hy-AM', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'Վճարված';
    case 'used':
      return 'Եկել է';
    case 'reserved':
      return 'Ամրագրված';
    case 'cancelled':
      return 'Չեղարկված';
    default:
      return status;
  }
}

function statusClasses(status: string): string {
  switch (status) {
    case 'paid':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'used':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'reserved':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export default function AdminReportsClient() {
  const initialRange = presetRange('thisWeek');
  const [preset, setPreset] = useState<PresetKey>('thisWeek');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [basis, setBasis] = useState<ReportBasis>('screening');

  const [data, setData] = useState<MovieReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMovies, setExpandedMovies] = useState<Set<number>>(
    () => new Set()
  );
  const [expandedScreenings, setExpandedScreenings] = useState<Set<number>>(
    () => new Set()
  );

  const load = useCallback(
    async (range: { from: string; to: string }, reportBasis: ReportBasis) => {
      setIsLoading(true);
      setError(null);
      const result = await getMovieReports({
        from: range.from,
        to: range.to,
        basis: reportBasis,
      });
      if (result.success && result.data) {
        setData(result.data);
        setExpandedMovies(new Set());
        setExpandedScreenings(new Set());
      } else {
        setError(result.error || 'Սխալ է տեղի ունեցել');
        setData(null);
      }
      setIsLoading(false);
    },
    []
  );

  useEffect(() => {
    void load({ from: initialRange.from, to: initialRange.to }, 'screening');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (key: Exclude<PresetKey, 'custom'>) => {
    const range = presetRange(key);
    setPreset(key);
    setFrom(range.from);
    setTo(range.to);
    void load(range, basis);
  };

  const applyCustom = () => {
    setPreset('custom');
    void load({ from, to }, basis);
  };

  const changeBasis = (next: ReportBasis) => {
    setBasis(next);
    void load({ from, to }, next);
  };

  const maxWeeklySold = useMemo(() => {
    if (!data || data.weekly.length === 0) return 0;
    return Math.max(...data.weekly.map((w) => w.sold), 1);
  }, [data]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!data) return;
    const headers = [
      'Ֆիլմ',
      'Վաճառված',
      'Եկել են դիտելու',
      'Չներկայացած',
      'Ամրագրված',
      'Չեղարկված',
      'Եկամուտ (֏)',
      'Ցուցադրություններ',
      'Տեղեր',
      'Լրացվածություն (%)',
    ];
    const lines = data.rows.map((r) =>
      [
        `"${r.title.replace(/"/g, '""')}"`,
        r.sold,
        r.attended,
        r.noShow,
        r.reserved,
        r.cancelled,
        Math.round(r.revenue),
        r.screenings,
        r.capacity,
        Math.round(r.occupancy * 100),
      ].join(',')
    );
    const totalsLine = [
      '"ԸՆԴԱՄԵՆԸ"',
      data.totals.sold,
      data.totals.attended,
      data.totals.noShow,
      data.totals.reserved,
      data.totals.cancelled,
      Math.round(data.totals.revenue),
      data.totals.screenings,
      data.totals.capacity,
      Math.round(data.totals.occupancy * 100),
    ].join(',');

    const csv = '\uFEFF' + [headers.join(','), ...lines, totalsLine].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hashvetvutyun_${from}_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleMovie = (movieId: number) => {
    setExpandedMovies((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) next.delete(movieId);
      else next.add(movieId);
      return next;
    });
  };

  const toggleScreening = (screeningId: number) => {
    setExpandedScreenings((prev) => {
      const next = new Set(prev);
      if (next.has(screeningId)) next.delete(screeningId);
      else next.add(screeningId);
      return next;
    });
  };

  const summaryCards = data
    ? [
        {
          label: 'Վաճառված տոմսեր',
          value: data.totals.sold.toLocaleString('hy-AM'),
          icon: TicketIcon,
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
        {
          label: 'Եկել են դիտելու',
          value: data.totals.attended.toLocaleString('hy-AM'),
          icon: CheckCircle2,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
        },
        {
          label: 'Չներկայացած',
          value: data.totals.noShow.toLocaleString('hy-AM'),
          icon: UserX,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
        },
        {
          label: 'Չեղարկված',
          value: data.totals.cancelled.toLocaleString('hy-AM'),
          icon: XCircle,
          color: 'text-red-600',
          bg: 'bg-red-50',
        },
        {
          label: 'Եկամուտ',
          value: formatAmd(data.totals.revenue),
          icon: TrendingUp,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
        },
        {
          label: 'Լրացվածություն',
          value: formatPercent(data.totals.occupancy),
          icon: BarChart3,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
        },
      ]
    : [];

  return (
    <div className="p-4 sm:p-6">
      {/* Վերնագիր */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Ֆիլմերի հաշվետվություն
            </h1>
            <p className="text-sm text-gray-600">
              Տոմսերի վաճառք, ներկայություն, չեղարկումներ ըստ ֆիլմերի
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handleExportCsv}
            disabled={!data || isLoading}
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={!data || isLoading}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Տպել
          </button>
        </div>
      </div>

      {/* Ֆիլտրեր */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          {/* Presets */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">
              Ժամանակահատված
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                Object.keys(PRESET_LABELS) as Exclude<PresetKey, 'custom'>[]
              ).map((key) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    preset === key
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {PRESET_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Custom range */}
          <div className="flex items-end gap-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">Սկիզբ</p>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset('custom');
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">Վերջ</p>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset('custom');
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              onClick={applyCustom}
              className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-gray-700"
            >
              Կիրառել
            </button>
          </div>

          {/* Basis toggle */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">
              Հաշվարկման հիմք
            </p>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
              <button
                onClick={() => changeBasis('screening')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  basis === 'screening'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Ցուցադրության օր
              </button>
              <button
                onClick={() => changeBasis('sale')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  basis === 'sale'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Վաճառքի օր
              </button>
            </div>
          </div>

          <button
            onClick={() => void load({ from, to }, basis)}
            disabled={isLoading}
            className="ml-auto flex items-center gap-2 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title="Թարմացնել"
          >
            <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Տպման վերնագիր */}
      <div className="mb-4 hidden print:block">
        <h2 className="text-xl font-bold">GoCinema — Ֆիլմերի հաշվետվություն</h2>
        <p className="text-sm text-gray-600">
          {formatDayLabel(from)} – {formatDayLabel(to)} ·{' '}
          {basis === 'screening' ? 'Ըստ ցուցադրության օրվա' : 'Ըստ վաճառքի օրվա'}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 text-gray-400">
          <Film className="h-12 w-12" />
          <p className="text-sm">Այս ժամանակահատվածում տվյալներ չկան</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Ամփոփ քարտեր */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div
                  className={`mb-2 inline-flex rounded-lg ${card.bg} p-2`}
                >
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Շաբաթական դինամիկա */}
          {data.weekly.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
                Շաբաթական դինամիկա
              </h3>
              <div className="flex items-end gap-3 overflow-x-auto pb-2">
                {data.weekly.map((week) => {
                  const heightPct = Math.max(
                    (week.sold / maxWeeklySold) * 100,
                    week.sold > 0 ? 6 : 2
                  );
                  return (
                    <div
                      key={week.weekStart}
                      className="flex min-w-[64px] flex-1 flex-col items-center gap-2"
                    >
                      <span className="text-xs font-bold text-gray-900">
                        {week.sold}
                      </span>
                      <div className="flex h-32 w-full items-end justify-center">
                        <div
                          className="w-9 rounded-t-lg bg-linear-to-t from-indigo-500 to-indigo-400 transition-all"
                          style={{ height: `${heightPct}%` }}
                          title={`Վաճառված՝ ${week.sold} · Եկամուտ՝ ${formatAmd(
                            week.revenue
                          )}`}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[10px] text-gray-500">
                        {formatDayLabel(week.weekStart)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-xs sm:grid-cols-4">
                {data.weekly.map((week) => (
                  <div
                    key={`detail-${week.weekStart}`}
                    className="rounded-lg bg-gray-50 p-2.5"
                  >
                    <p className="font-semibold text-gray-700">
                      {formatDayLabel(week.weekStart)}-ից
                    </p>
                    <p className="text-gray-500">
                      Վաճ. {week.sold} · Եկ. {formatAmd(week.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ֆիլմերի աղյուսակ */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3">
              <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                <Film className="h-5 w-5 text-gray-500" />
                Ֆիլմ-առ-ֆիլմ
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-medium">Ֆիլմ</th>
                    <th className="px-3 py-3 text-center font-medium">
                      Վաճառված
                    </th>
                    <th className="px-3 py-3 text-center font-medium">
                      Դիտել են
                    </th>
                    <th className="px-3 py-3 text-center font-medium">
                      Չներկ.
                    </th>
                    <th className="px-3 py-3 text-center font-medium">Ամրագր.</th>
                    <th className="px-3 py-3 text-center font-medium">
                      Չեղարկ.
                    </th>
                    <th className="px-3 py-3 text-center font-medium">
                      Ցուցադր.
                    </th>
                    <th className="px-3 py-3 text-center font-medium">
                      Լրացված.
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Եկամուտ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const isExpanded = expandedMovies.has(row.movieId);
                    return (
                      <Fragment key={row.movieId}>
                        <tr
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => toggleMovie(row.movieId)}
                                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 print:hidden"
                                title="Բացել ցուցադրությունները"
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                              <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100">
                                {row.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={row.image}
                                    alt={row.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                                    <Film className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">
                                  {row.title}
                                </span>
                                <p className="text-xs text-gray-500 print:hidden">
                                  {row.screeningDetails.length} ցուցադրություն · մանրամասն
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center font-semibold text-gray-900">
                            {row.sold}
                          </td>
                          <td className="px-3 py-3 text-center text-emerald-600">
                            {row.attended}
                          </td>
                          <td className="px-3 py-3 text-center text-orange-600">
                            {row.noShow}
                          </td>
                          <td className="px-3 py-3 text-center text-gray-500">
                            {row.reserved}
                          </td>
                          <td className="px-3 py-3 text-center text-red-500">
                            {row.cancelled}
                          </td>
                          <td className="px-3 py-3 text-center text-gray-600">
                            {row.screenings}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                row.occupancy >= 0.7
                                  ? 'bg-green-100 text-green-700'
                                  : row.occupancy >= 0.4
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {formatPercent(row.occupancy)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {formatAmd(row.revenue)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="bg-gray-50/70 px-4 py-4">
                              <MovieScreeningDetails
                                screenings={row.screeningDetails}
                                expandedScreenings={expandedScreenings}
                                onToggleScreening={toggleScreening}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-gray-900">
                    <td className="px-4 py-3">ԸՆԴԱՄԵՆԸ</td>
                    <td className="px-3 py-3 text-center">{data.totals.sold}</td>
                    <td className="px-3 py-3 text-center text-emerald-700">
                      {data.totals.attended}
                    </td>
                    <td className="px-3 py-3 text-center text-orange-700">
                      {data.totals.noShow}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {data.totals.reserved}
                    </td>
                    <td className="px-3 py-3 text-center text-red-600">
                      {data.totals.cancelled}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {data.totals.screenings}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {formatPercent(data.totals.occupancy)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatAmd(data.totals.revenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            «Դիտել են»՝ սկանավորված մուտքով տոմսեր (used)։ «Չներկայացած»՝
            ավարտված ցուցադրության վճարված, բայց չսկանավորված տոմսեր։
            «Վաճառված»՝ paid + used։
          </p>
        </div>
      )}
    </div>
  );
}

function MovieScreeningDetails({
  screenings,
  expandedScreenings,
  onToggleScreening,
}: {
  screenings: MovieReportData['rows'][number]['screeningDetails'];
  expandedScreenings: Set<number>;
  onToggleScreening: (screeningId: number) => void;
}) {
  if (screenings.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Այս ֆիլմի համար ընտրված միջակայքում ցուցադրություններ չկան
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {screenings.map((screening) => {
        const isOpen = expandedScreenings.has(screening.id);
        return (
          <div
            key={screening.id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <button
              type="button"
              onClick={() => onToggleScreening(screening.id)}
              className="flex w-full flex-col gap-3 px-4 py-3 text-left hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
                <div>
                  <p className="font-semibold text-gray-900">
                    {formatDateTime(screening.startTime)} · {screening.hallName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Տեղեր {screening.capacity} · տոմսեր {screening.tickets.length}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-xs sm:min-w-[420px]">
                <MiniMetric label="Վաճառ." value={screening.sold} tone="green" />
                <MiniMetric label="Եկել" value={screening.attended} tone="emerald" />
                <MiniMetric label="Չներկ." value={screening.noShow} tone="orange" />
                <MiniMetric label="Ամրագր." value={screening.reserved} tone="amber" />
                <MiniMetric label="Չեղ." value={screening.cancelled} tone="red" />
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 p-4">
                {screening.tickets.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                    Այս ցուցադրության համար տոմսեր չկան
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-3 py-2">Աթոռ</th>
                          <th className="px-3 py-2">Կարգավիճակ</th>
                          <th className="px-3 py-2">Հաճախորդ</th>
                          <th className="px-3 py-2">Հեռախոս</th>
                          <th className="px-3 py-2">Պատվեր</th>
                          <th className="px-3 py-2">Ապրանքներ</th>
                          <th className="px-3 py-2 text-right">Գումար</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {screening.tickets.map((ticket) => {
                          const hasProducts = ticket.orderItems.length > 0;
                          const isNoShow =
                            (ticket.status === 'paid' &&
                              new Date(screening.endTime) < new Date()) ||
                            ticket.noShow;
                          return (
                            <tr key={ticket.id} className="hover:bg-gray-50/80">
                              <td className="px-3 py-2">
                                <div className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2 py-1 font-semibold text-gray-800">
                                  <Armchair className="h-4 w-4 text-gray-500" />
                                  {ticket.seat
                                    ? `${ticket.seat.row}${ticket.seat.number}`
                                    : '—'}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  <span
                                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClasses(
                                      ticket.status
                                    )}`}
                                  >
                                    {statusLabel(ticket.status)}
                                  </span>
                                  {isNoShow && (
                                    <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                      Չի եկել
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-900">
                                  {ticket.user.name || '—'}
                                </div>
                                {ticket.user.email && (
                                  <div className="text-xs text-gray-500">
                                    {ticket.user.email}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {ticket.user.phone || '—'}
                              </td>
                              <td className="px-3 py-2">
                                {ticket.order ? (
                                  <div>
                                    <div className="font-semibold text-gray-900">
                                      #{ticket.order.id}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {ticket.order.paymentMethod} ·{' '}
                                      {ticket.order.status}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {hasProducts ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {ticket.orderItems.map((item) => (
                                      <span
                                        key={`${ticket.id}-${item.id}`}
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                                          item.ticketId === null
                                            ? 'bg-purple-50 text-purple-700'
                                            : 'bg-blue-50 text-blue-700'
                                        }`}
                                      >
                                        <ShoppingCart className="h-3 w-3" />
                                        {item.product.name} x{item.quantity}
                                        {item.ticketId === null ? ' · ընդհանուր' : ''}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">
                                    Ապրանք չկա
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                {formatAmd(ticket.price)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'emerald' | 'orange' | 'amber' | 'red';
}) {
  const classes: Record<typeof tone, string> = {
    green: 'bg-green-50 text-green-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    orange: 'bg-orange-50 text-orange-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className={`rounded-lg px-2 py-1 ${classes[tone]}`}>
      <div className="font-bold">{value}</div>
      <div>{label}</div>
    </div>
  );
}
