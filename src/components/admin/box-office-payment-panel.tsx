'use client';

import { useMemo } from 'react';
import { Banknote, CreditCard } from 'lucide-react';

export type PaymentMethod = 'cash' | 'card';

interface PaymentPanelProps {
  total: number;
  method: PaymentMethod;
  setMethod: (method: PaymentMethod) => void;
  /** Ստացված կանխիկ գումարը. '' նշանակում է դեռ չմուտքագրված */
  cashReceived: number | '';
  setCashReceived: (value: number | '') => void;
  accent?: 'green' | 'amber';
  disabled?: boolean;
}

const accents = {
  green: {
    active: 'border-green-500 bg-green-600 text-white shadow-sm',
    inactive: 'border-gray-200 bg-white text-gray-600 hover:border-green-300',
    chip: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
    input: 'focus:border-green-500 focus:ring-green-100',
    change: 'text-green-700',
  },
  amber: {
    active: 'border-amber-500 bg-amber-500 text-white shadow-sm',
    inactive: 'border-gray-200 bg-white text-gray-600 hover:border-amber-300',
    chip: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
    input: 'focus:border-amber-500 focus:ring-amber-100',
    change: 'text-amber-700',
  },
};

export default function PaymentPanel({
  total,
  method,
  setMethod,
  cashReceived,
  setCashReceived,
  accent = 'green',
  disabled = false,
}: PaymentPanelProps) {
  const a = accents[accent];

  // Արագ կանխիկ առաջարկներ՝ ճիշտ գումար + կլորացված տարբերակներ + թղթադրամներ
  const suggestions = useMemo(() => {
    if (total <= 0) return [];
    const set = new Set<number>();
    set.add(total);
    const roundUp = (step: number) => Math.ceil(total / step) * step;
    [500, 1000, 5000].forEach((step) => set.add(roundUp(step)));
    [1000, 2000, 5000, 10000, 20000].forEach((bill) => {
      if (bill >= total) set.add(bill);
    });
    return Array.from(set)
      .filter((v) => v > 0)
      .sort((x, y) => x - y)
      .slice(0, 5);
  }, [total]);

  const received = cashReceived === '' ? null : Number(cashReceived);
  const change = received !== null ? received - total : null;
  const insufficient = received !== null && received < total;

  return (
    <div className="space-y-3">
      {/* Վճարման եղանակ */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Վճարման եղանակ
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMethod('cash')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              method === 'cash' ? a.active : a.inactive
            }`}
          >
            <Banknote className="h-4 w-4" />
            Կանխիկ
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMethod('card')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              method === 'card' ? a.active : a.inactive
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Քարտով
          </button>
        </div>
      </div>

      {/* Կանխիկի դեպքում՝ ստացված գումար + մանր */}
      {method === 'cash' && (
        <div className="space-y-2">
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setCashReceived(value)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${a.chip}`}
                >
                  {value === total
                    ? 'Ճիշտ գումար'
                    : `${value.toLocaleString()} ֏`}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Ստացված կանխիկ
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={100}
                disabled={disabled}
                value={cashReceived}
                onChange={(e) =>
                  setCashReceived(
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
                placeholder="0"
                className={`w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base font-bold focus:outline-none focus:ring-2 ${a.input} disabled:bg-gray-50`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                ֏
              </span>
            </div>
          </div>

          {/* Մանր / պակասուրդ */}
          <div
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${
              insufficient
                ? 'bg-red-50 text-red-700'
                : 'bg-gray-50 text-gray-700'
            }`}
          >
            <span className="font-medium">
              {insufficient ? 'Պակասում է' : 'Մանր (հետ վերադարձ)'}
            </span>
            <span
              className={`text-lg font-extrabold ${
                insufficient ? 'text-red-600' : a.change
              }`}
            >
              {received === null
                ? '—'
                : insufficient
                  ? `${Math.abs(change as number).toLocaleString()} ֏`
                  : `${(change as number).toLocaleString()} ֏`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
