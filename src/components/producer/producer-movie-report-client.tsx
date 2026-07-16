'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  Film,
  TicketCheck,
  Wallet,
  Users,
  UserCheck,
  UserX,
  Clock,
  XCircle,
  ChevronDown,
  CalendarRange,
  Armchair,
} from 'lucide-react';
import { SITE_URL } from '@/utils/consts';
import {
  getProducerMovieReport,
  type ProducerMovieReport,
  type ProducerScreeningRow,
} from '@/app/actions/producer';
import ProducerScreeningSeatMap from './producer-screening-seat-map';

interface Props {
  movieId: number;
}

function formatAmd(value: number): string {
  return `${Math.round(value).toLocaleString('hy-AM')} ֏`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('hy-AM', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('hy-AM', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('hy-AM', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** CSV cell escaping */
function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const content = rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  // BOM ֊ որ Excel-ը հայերենը ճիշտ կարդա
  const blob = new Blob(['\uFEFF' + content], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ProducerMovieReportClient({ movieId }: Props) {
  const [data, setData] = useState<ProducerMovieReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getProducerMovieReport({
      movieId,
      from: from || undefined,
      to: to || undefined,
    });
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || 'Հաշվետվությունը բեռնելիս սխալ է տեղի ունեցել');
      setData(null);
    }
    setIsLoading(false);
  }, [movieId, from, to]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId]);

  const toggleExpand = (screeningId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(screeningId)) next.delete(screeningId);
      else next.add(screeningId);
      return next;
    });
  };

  const totals = data?.totals;

  const summaryCards = useMemo(() => {
    if (!totals) return [];
    return [
      {
        label: 'Ցուցադրություն',
        value: totals.screenings.toLocaleString('hy-AM'),
        icon: CalendarRange,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
      },
      {
        label: 'Վաճառված տոմս',
        value: totals.sold.toLocaleString('hy-AM'),
        icon: TicketCheck,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
      },
      {
        label: 'Հասույթ',
        value: formatAmd(totals.revenue),
        icon: Wallet,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
      },
      {
        label: 'Զբաղվածություն',
        value: `${Math.round(totals.occupancy * 100)}%`,
        icon: Users,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
      },
      {
        label: 'Ներկա (սկանավորված)',
        value: totals.attended.toLocaleString('hy-AM'),
        icon: UserCheck,
        color: 'text-green-600',
        bg: 'bg-green-50',
      },
      {
        label: 'Չներկայացած',
        value: totals.noShow.toLocaleString('hy-AM'),
        icon: UserX,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
      },
      {
        label: 'Ամրագրված',
        value: totals.reserved.toLocaleString('hy-AM'),
        icon: Clock,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
      },
      {
        label: 'Չեղարկված',
        value: totals.cancelled.toLocaleString('hy-AM'),
        icon: XCircle,
        color: 'text-red-600',
        bg: 'bg-red-50',
      },
    ];
  }, [totals]);

  const handleExportSummary = () => {
    if (!data) return;
    const header = [
      'Ցուցադրություն (ամսաթիվ/ժամ)',
      'Դահլիճ',
      'Տեղեր',
      'Վաճառված',
      'Ներկա',
      'Չներկայացած',
      'Ամրագրված',
      'Չեղարկված',
      'Հասույթ (֏)',
      'Զբաղվածություն (%)',
    ];
    const rows: (string | number)[][] = [header];
    for (const s of data.screenings) {
      rows.push([
        formatDateTime(s.startTime),
        s.hallName,
        s.capacity,
        s.sold,
        s.attended,
        s.noShow,
        s.reserved,
        s.cancelled,
        Math.round(s.revenue),
        Math.round(s.occupancy * 100),
      ]);
    }
    rows.push([
      'ԸՆԴԱՄԵՆԸ',
      '',
      data.totals.capacity,
      data.totals.sold,
      data.totals.attended,
      data.totals.noShow,
      data.totals.reserved,
      data.totals.cancelled,
      Math.round(data.totals.revenue),
      Math.round(data.totals.occupancy * 100),
    ]);
    const safeTitle = data.movie.title.replace(/[^\p{L}\p{N}]+/gu, '_');
    downloadCsv(`${safeTitle}_ampop.csv`, rows);
  };

  const handleExportSeats = () => {
    if (!data) return;
    const header = [
      'Ցուցադրություն (ամսաթիվ/ժամ)',
      'Դահլիճ',
      'Շարք',
      'Տեղ',
      'Տեսակ',
      'Կարգավիճակ',
      'Գին (֏)',
    ];
    const rows: (string | number)[][] = [header];
    for (const s of data.screenings) {
      for (const seat of s.hallSeats) {
        if (!seat.ticket || seat.ticket.status === 'cancelled') continue;
        const st = seat.ticket.status;
        rows.push([
          formatDateTime(s.startTime),
          s.hallName,
          seat.row,
          seat.number,
          seat.seatType === 'vip' ? 'VIP' : 'Ստանդարտ',
          st === 'used'
            ? 'Ներկա'
            : st === 'paid'
              ? 'Վճարված'
              : st === 'awaiting_payment'
                ? 'Սպասում է վճարման'
                : st === 'reserved'
                  ? 'Ամրագրված'
                  : st,
          Math.round(seat.ticket.price),
        ]);
      }
    }
    const safeTitle = data.movie.title.replace(/[^\p{L}\p{N}]+/gu, '_');
    downloadCsv(`${safeTitle}_tegh_er.csv`, rows);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16">
      <div className="container mx-auto px-4">
        <Link
          href={SITE_URL.PRODUCER}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-purple-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Բոլոր ֆիլմերը
        </Link>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : !data ? null : (
          <>
            {/* Movie header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                {data.movie.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.movie.image}
                    alt={data.movie.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                    <Film className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                  {data.movie.title}
                </h1>
                <p className="text-sm text-gray-500">
                  Ֆիլմի մանրամասն հաշվետվություն
                </p>
              </div>
            </div>

            {/* Filters + export */}
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Սկսած
                  </label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Մինչև
                  </label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                </div>
                <button
                  onClick={() => void load()}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
                >
                  Կիրառել
                </button>
                {(from || to) && (
                  <button
                    onClick={() => {
                      setFrom('');
                      setTo('');
                      setTimeout(() => void load(), 0);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                  >
                    Մաքրել
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExportSummary}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Download className="h-4 w-4" />
                  CSV (ամփոփ)
                </button>
                <button
                  onClick={handleExportSeats}
                  className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
                >
                  <Download className="h-4 w-4" />
                  CSV (տեղեր)
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div
                    className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}
                  >
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Screenings list */}
            <h2 className="mb-3 text-lg font-bold text-gray-900">
              Ցուցադրություններ
            </h2>
            {data.screenings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-500">
                Ընտրված ժամանակահատվածում ցուցադրություններ չկան
              </div>
            ) : (
              <div className="space-y-3">
                {data.screenings.map((s) => (
                  <ScreeningRow
                    key={s.screeningId}
                    screening={s}
                    expanded={expanded.has(s.screeningId)}
                    onToggle={() => toggleExpand(s.screeningId)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScreeningRow({
  screening,
  expanded,
  onToggle,
}: {
  screening: ProducerScreeningRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const s = screening;
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-gray-50"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">
            {formatDate(s.startTime)} · {formatTime(s.startTime)}
          </p>
          <p className="text-xs text-gray-500">{s.hallName}</p>
        </div>

        <div className="hidden items-center gap-6 sm:flex">
          <div className="text-center">
            <p className="text-sm font-bold text-purple-600">{s.sold}</p>
            <p className="text-[11px] text-gray-400">վաճառված</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-emerald-600">
              {formatAmd(s.revenue)}
            </p>
            <p className="text-[11px] text-gray-400">հասույթ</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-indigo-600">
              {Math.round(s.occupancy * 100)}%
            </p>
            <p className="text-[11px] text-gray-400">
              {s.sold}/{s.capacity}
            </p>
          </div>
        </div>

        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Mobile quick stats */}
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2 text-xs text-gray-500 sm:hidden">
        <span className="font-semibold text-purple-600">{s.sold} վաճ.</span>
        <span className="font-semibold text-emerald-600">
          {formatAmd(s.revenue)}
        </span>
        <span className="font-semibold text-indigo-600">
          {Math.round(s.occupancy * 100)}%
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100 bg-gray-50"
          >
            <div className="p-4">
              {/* Detail stats */}
              <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                <MiniStat label="Տեղեր" value={s.capacity} />
                <MiniStat label="Վաճառված" value={s.sold} tone="purple" />
                <MiniStat label="Ներկա" value={s.attended} tone="green" />
                <MiniStat label="Չներկա" value={s.noShow} tone="orange" />
                <MiniStat label="Ամրագրված" value={s.reserved} tone="amber" />
                <MiniStat label="Չեղարկ." value={s.cancelled} tone="red" />
              </div>

              {/* Seat map */}
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Armchair className="h-4 w-4 text-purple-500" />
                Դահլիճի սխեմա
              </div>
              <ProducerScreeningSeatMap hallSeats={s.hallSeats} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = 'gray',
}: {
  label: string;
  value: number;
  tone?: 'gray' | 'purple' | 'green' | 'orange' | 'amber' | 'red';
}) {
  const toneClasses: Record<string, string> = {
    gray: 'text-gray-900',
    purple: 'text-purple-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };
  return (
    <div className="rounded-lg bg-white px-2 py-2 text-center">
      <p className={`text-base font-bold ${toneClasses[tone]}`}>{value}</p>
      <p className="text-[11px] text-gray-400">{label}</p>
    </div>
  );
}
