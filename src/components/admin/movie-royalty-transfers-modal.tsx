'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banknote, Check, X } from 'lucide-react';
import {
  getMovieMonthlyRoyaltyTransfers,
  setMovieMonthRoyaltyTransferred,
  type MovieRoyaltyTransferRow,
} from '@/app/actions/producer-royalty-transfers';
import { formatDateTimeHy, formatPrice } from '@/lib/format';

type Props = {
  movie: { id: number; title: string };
  onClose: () => void;
};

function formatAmd(amount: number): string {
  return `${formatPrice(amount)} ֏`;
}

function sortRows(rows: MovieRoyaltyTransferRow[]): MovieRoyaltyTransferRow[] {
  return [...rows].sort((a, b) => {
    if (a.transferred !== b.transferred) return a.transferred ? 1 : -1;
    return b.monthKey.localeCompare(a.monthKey);
  });
}

export default function MovieRoyaltyTransfersModal({ movie, onClose }: Props) {
  const [rows, setRows] = useState<MovieRoyaltyTransferRow[]>([]);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMovieMonthlyRoyaltyTransfers(movie.id);
      if (!result.success) {
        setError(result.error || 'Բեռնման սխալ');
        setRows([]);
        setUnpaidCount(0);
        setPaidCount(0);
        return;
      }
      setRows(result.rows || []);
      setUnpaidCount(result.unpaidCount || 0);
      setPaidCount(result.paidCount || 0);
    } catch (e) {
      console.error(e);
      setError('Փոխանցումների ցանկը բեռնելիս սխալ է տեղի ունեցել');
    } finally {
      setLoading(false);
    }
  }, [movie.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyCounts = (nextRows: MovieRoyaltyTransferRow[]) => {
    setUnpaidCount(nextRows.filter((r) => !r.transferred).length);
    setPaidCount(nextRows.filter((r) => r.transferred).length);
  };

  const toggle = async (row: MovieRoyaltyTransferRow, next: boolean) => {
    const previous = { ...row };
    setSavingKey(row.monthKey);
    setRows((current) => {
      const nextRows = sortRows(
        current.map((r) =>
          r.monthKey === row.monthKey
            ? {
                ...r,
                transferred: next,
                transferredAt: next
                  ? r.transferredAt ?? new Date().toISOString()
                  : null,
                transferredByName: next ? r.transferredByName : null,
              }
            : r
        )
      );
      applyCounts(nextRows);
      return nextRows;
    });

    try {
      const result = await setMovieMonthRoyaltyTransferred(
        movie.id,
        row.monthKey,
        next
      );
      if (!result.success) {
        setRows((current) => {
          const restored = sortRows(
            current.map((r) => (r.monthKey === row.monthKey ? previous : r))
          );
          applyCounts(restored);
          return restored;
        });
        alert(result.error || 'Չհաջողվեց պահպանել');
        return;
      }

      setRows((current) =>
        sortRows(
          current.map((r) =>
            r.monthKey === row.monthKey
              ? {
                  ...r,
                  transferred: Boolean(result.transferredAt),
                  transferredAt: result.transferredAt ?? null,
                  transferredByName: result.transferredByName ?? null,
                }
              : r
          )
        )
      );
    } catch (e) {
      console.error(e);
      setRows((current) => {
        const restored = sortRows(
          current.map((r) => (r.monthKey === row.monthKey ? previous : r))
        );
        applyCounts(restored);
        return restored;
      });
      alert('Փոխանցման կարգավիճակը պահելիս սխալ է տեղի ունեցել');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-emerald-700">
              <Banknote className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Փոխանցումներ
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              «{movie.title}»
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Ամսական հոնորար՝ ամսի 1-ից մինչև վերջ, ըստ վաճառված տոմսերի
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!loading && !error && rows.length > 0 && (
          <div className="flex gap-3 border-b border-gray-100 px-5 py-3 text-sm">
            <span className="rounded-lg bg-amber-50 px-3 py-1.5 font-medium text-amber-800">
              {unpaidCount} չվճարված
            </span>
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800">
              {paidCount} վճարված
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="py-8 text-center text-sm text-gray-500">
              Բեռնվում է…
            </p>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center">
              <p className="text-sm font-medium text-gray-700">
                Ավարտված ամիսներ դեռ չկան
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Ցանկում կհայտնվեն ամիսները, որոնցում եղել են ցուցադրություններ
              </p>
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((row) => {
                const paid = row.transferred;
                const busy = savingKey === row.monthKey;
                return (
                  <li
                    key={row.monthKey}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      paid
                        ? 'border-emerald-100 bg-emerald-50/40'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={paid}
                        disabled={busy}
                        onChange={(e) => void toggle(row, e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {row.periodLabel}
                          </span>
                          {paid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                              <Check className="h-3 w-3" />
                              Փոխանցված
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              Չփոխանցված
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-sm text-gray-700">
                          Փոխանցել՝{' '}
                          <span className="font-semibold">
                            {formatAmd(row.royaltyAmount)}
                          </span>
                          <span className="text-gray-400">
                            {' '}
                            · {row.royaltyPercent}% · եկամուտ{' '}
                            {formatAmd(row.revenue)} · {row.ticketsSold} տոմս
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-400">
                          {row.periodStart} – {row.periodEnd} ·{' '}
                          {row.screeningsCount} ցուցադրություն
                        </span>
                        {paid && row.transferredAt && (
                          <span className="mt-1 block text-xs text-gray-500">
                            Հաստատված՝ {formatDateTimeHy(row.transferredAt)}
                            {row.transferredByName
                              ? ` · ${row.transferredByName}`
                              : ''}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Փակել
          </button>
        </div>
      </div>
    </div>
  );
}
