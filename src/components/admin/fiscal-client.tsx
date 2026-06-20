'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Receipt,
  RotateCcw,
  Search,
  Ticket as TicketIcon,
  X,
} from 'lucide-react';
import {
  getFiscalTickets,
  markFiscalReceiptIssued,
  unmarkFiscalReceipt,
  type FiscalFilter,
} from '@/app/actions/fiscal';

interface FiscalTicket {
  paymentId: number;
  ticketId: number;
  amount: number;
  method: string;
  transactionId: string | null;
  createdAt: Date | string;
  fiscalReceiptIssued: boolean;
  fiscalReceiptNumber: string | null;
  fiscalReceiptAt: Date | string | null;
  customerName: string | null;
  customerPhone: string | null;
  ticketStatus: string;
  seat: { row: string; number: number; seatType: string } | null;
  movieTitle: string | null;
  hallName: string | null;
  startTime: Date | string | null;
}

interface FiscalSummary {
  total: number;
  issued: number;
  pending: number;
  pendingAmount: number;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Կանխիկ',
  card: 'Քարտ',
  bank_transfer: 'Փոխանցում',
  vpost: 'VPOS',
  telcell: 'Telcell',
};

function methodLabel(method: string) {
  return METHOD_LABELS[method] || method;
}

function formatAmount(value: number) {
  return `${value.toLocaleString('hy-AM')} ֏`;
}

function formatDateTime(value: Date | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('hy-AM', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const FILTERS: { id: FiscalFilter; label: string }[] = [
  { id: 'all', label: 'Բոլորը' },
  { id: 'pending', label: 'Չհաստատված' },
  { id: 'issued', label: 'Հաստատված' },
];

export default function FiscalClient() {
  const [tickets, setTickets] = useState<FiscalTicket[]>([]);
  const [summary, setSummary] = useState<FiscalSummary>({
    total: 0,
    issued: 0,
    pending: 0,
    pendingAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FiscalFilter>('pending');
  const [method, setMethod] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [pendingId, setPendingId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<FiscalTicket | null>(null);
  const [receiptNumber, setReceiptNumber] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getFiscalTickets({
      filter,
      method,
      search: debouncedSearch,
    });
    if (result.success) {
      setTickets(result.tickets as FiscalTicket[]);
      setSummary(result.summary);
    } else {
      setError(result.error || 'Սխալ է տեղի ունեցել');
    }
    setIsLoading(false);
  }, [filter, method, debouncedSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const methods = useMemo(() => {
    const set = new Set(tickets.map((t) => t.method));
    return Array.from(set);
  }, [tickets]);

  const openConfirm = (ticket: FiscalTicket) => {
    setConfirmTarget(ticket);
    setReceiptNumber('');
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    setPendingId(confirmTarget.paymentId);
    const result = await markFiscalReceiptIssued(
      confirmTarget.paymentId,
      receiptNumber
    );
    setPendingId(null);
    if (result.success) {
      setConfirmTarget(null);
      setReceiptNumber('');
      void load();
    } else {
      setError(result.error || 'Հաստատելիս սխալ է տեղի ունեցել');
    }
  };

  const handleRevert = async (ticket: FiscalTicket) => {
    setPendingId(ticket.paymentId);
    const result = await unmarkFiscalReceipt(ticket.paymentId);
    setPendingId(null);
    if (result.success) {
      void load();
    } else {
      setError(result.error || 'Փոփոխելիս սխալ է տեղի ունեցել');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Receipt className="h-6 w-6 text-teal-600" />
          ՀԴՄ չեկեր
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Բոլոր վաճառված տոմսերը։ Հաստատեք յուրաքանչյուր վաճառքի համար ՀԴՄ չեկը,
          երբ հարկը վճարված է։
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <TicketIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Ընդհանուր վաճառք</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">Հաստատված</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-600">{summary.issued}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Մնացած</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{summary.pending}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Receipt className="h-4 w-4" />
            <span className="text-xs font-medium">Չհաստատված գումար</span>
          </div>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {formatAmount(summary.pendingAmount)}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filter === f.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="all">Բոլոր եղանակները</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {methodLabel(m)}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Որոնել՝ տոմս #, ֆիլմ, հեռախոս..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 focus:border-teal-500 focus:outline-none sm:w-72"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white py-20 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-20 text-center text-gray-400">
          Տոմսեր չկան
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-semibold">Տոմս</th>
                  <th className="px-4 py-3 font-semibold">Ֆիլմ / Տեղ</th>
                  <th className="px-4 py-3 font-semibold">Հաճախորդ</th>
                  <th className="px-4 py-3 font-semibold">Եղանակ</th>
                  <th className="px-4 py-3 font-semibold">Գումար</th>
                  <th className="px-4 py-3 font-semibold">Վաճառք</th>
                  <th className="px-4 py-3 font-semibold">ՀԴՄ</th>
                  <th className="px-4 py-3 text-right font-semibold">Գործողություն</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tickets.map((t) => (
                  <tr key={t.paymentId} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                      #{t.ticketId}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {t.movieTitle || '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t.hallName || '—'}
                        {t.seat ? ` · ${t.seat.row}${t.seat.number}` : ''}
                        {t.seat?.seatType === 'vip' ? ' · VIP' : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{t.customerName || '—'}</p>
                      <p className="text-xs text-gray-500">{t.customerPhone || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{methodLabel(t.method)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {formatAmount(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {t.fiscalReceiptIssued ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Հաստատված
                          {t.fiscalReceiptNumber ? ` · ${t.fiscalReceiptNumber}` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          <Clock className="h-3.5 w-3.5" />
                          Սպասում է
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.fiscalReceiptIssued ? (
                        <button
                          onClick={() => handleRevert(t)}
                          disabled={pendingId === t.paymentId}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
                        >
                          {pendingId === t.paymentId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Հետ բերել
                        </button>
                      ) : (
                        <button
                          onClick={() => openConfirm(t)}
                          disabled={pendingId === t.paymentId}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          ՀԴՄ հաստատել
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-gray-50 lg:hidden">
            {tickets.map((t) => (
              <div key={t.paymentId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      <span className="font-mono text-gray-500">#{t.ticketId}</span>{' '}
                      {t.movieTitle || '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.hallName || '—'}
                      {t.seat ? ` · ${t.seat.row}${t.seat.number}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {t.customerName || '—'} {t.customerPhone || ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatAmount(t.amount)}
                    </p>
                    <p className="text-xs text-gray-500">{methodLabel(t.method)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {t.fiscalReceiptIssued ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Հաստատված
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      <Clock className="h-3.5 w-3.5" />
                      Սպասում է
                    </span>
                  )}
                  {t.fiscalReceiptIssued ? (
                    <button
                      onClick={() => handleRevert(t)}
                      disabled={pendingId === t.paymentId}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
                    >
                      {pendingId === t.paymentId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Հետ բերել
                    </button>
                  ) : (
                    <button
                      onClick={() => openConfirm(t)}
                      disabled={pendingId === t.paymentId}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      ՀԴՄ հաստատել
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <Receipt className="h-5 w-5 text-teal-600" />
                ՀԴՄ չեկ հաստատել
              </h3>
              <button
                onClick={() => setConfirmTarget(null)}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
              <p>
                <span className="font-mono text-gray-500">#{confirmTarget.ticketId}</span>{' '}
                {confirmTarget.movieTitle || ''}
                {confirmTarget.seat
                  ? ` · ${confirmTarget.seat.row}${confirmTarget.seat.number}`
                  : ''}
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {formatAmount(confirmTarget.amount)} ·{' '}
                {methodLabel(confirmTarget.method)}
              </p>
            </div>

            <label className="mb-1 block text-sm font-medium text-gray-700">
              ՀԴՄ չեկի համար (ոչ պարտադիր)
            </label>
            <input
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="Օր․՝ 12345678"
              className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />

            <p className="mb-4 text-xs text-gray-500">
              Հաստատելով՝ նշում եք, որ այս վաճառքի համար ՀԴՄ չեկը հանված է և հարկը
              վճարված է։
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Չեղարկել
              </button>
              <button
                onClick={handleConfirm}
                disabled={pendingId === confirmTarget.paymentId}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {pendingId === confirmTarget.paymentId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Հաստատել
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
