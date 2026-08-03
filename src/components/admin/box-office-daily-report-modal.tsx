'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  Download,
  Loader2,
  Package,
  Ticket,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  getBoxOfficeDailyReport,
  type BoxOfficeDailyReport,
} from '@/app/actions/box-office-daily-report';
import { openBoxOfficeDailyReportPdf } from '@/lib/box-office-daily-report-pdf';

const CATEGORY_LABELS: Record<string, string> = {
  snack: 'Նախուտեստ',
  drink: 'Խմիչք',
  combo: 'Կոմբո',
  popcorn: 'Պոպկորն',
  iced_tea: 'Սառը թեյ',
  soda: 'Գազավորված',
  candy: 'Քաղցրավենիք',
  hot_dog: 'Հոթ-դոգ',
  nachos: 'Նաչոս',
  coffee: 'Սրճարան',
  tea: 'Թեյ',
  juice: 'Հյութ',
  water: 'Ջուր',
  chips: 'Չիպս',
  chocolate: 'Շոկոլադ',
  ice_cream: 'Պաղպաղակ',
  sandwich: 'Սենդվիչ',
  pizza: 'Պիցցա',
  burger: 'Բուրգեր',
  salad: 'Աղցան',
  other: 'Այլ',
};

function formatAmd(amount: number) {
  return `${Math.round(amount).toLocaleString('hy-AM')} ֏`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('hy-AM', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString('hy-AM', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function BoxOfficeDailyReportModal({ open, onClose }: Props) {
  const [data, setData] = useState<BoxOfficeDailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getBoxOfficeDailyReport();
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setData(null);
          setError(result.error ?? 'Հաշվետվությունը բեռնել չհաջողվեց');
        }
      } catch {
        setData(null);
        setError('Հաշվետվությունը բեռնելիս սխալ է տեղի ունեցել');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [open]);

  if (!open) return null;

  const handlePdf = () => {
    if (!data) return;
    const ok = openBoxOfficeDailyReportPdf(data);
    if (!ok) {
      alert('Չհաջողվեց բացել PDF պատուհանը։ Ստուգեք popup-ի արգելափակումը։');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Օրվա հաշվետվություն
            </h2>
            {data && (
              <p className="mt-1 text-sm text-gray-500">
                {formatDay(data.periodStart)} · {formatTime(data.periodStart)} —{' '}
                {formatTime(data.periodEnd)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePdf}
              disabled={!data || isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-20 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Բեռնվում է…
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!isLoading && data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Մաքուր եկամուտ
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {formatAmd(data.totals.netRevenue)}
                  </p>
                  {data.totals.refunds > 0 && (
                    <p className="mt-1 text-xs text-red-600">
                      Վերադարձ/չեղարկում −{formatAmd(data.totals.refunds)}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Ապրանքների ինքնաարժեք
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {formatAmd(data.totals.productCost)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Մաքուր շահույթ
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-800">
                    {formatAmd(data.totals.netProfit)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    Կանխիկ
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {formatAmd(data.totals.byPayment.cash)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    Քարտ
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {formatAmd(data.totals.byPayment.card)}
                  </p>
                </div>
              </div>

              {data.products.missingCostCount > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    {data.products.missingCostCount} ապրանքի ինքնաարժեք
                    բացակայում է։ Այդ տողերի շահույթը հավասար է եկամուտին։
                    Լրացրեք ինքնաարժեքը Ապրանքներ բաժնում։
                  </p>
                </div>
              )}

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Տոմսեր
                  </h3>
                  <span className="text-sm text-gray-500">
                    {data.tickets.soldCount} վաճառված ·{' '}
                    {formatAmd(data.tickets.netRevenue)}
                  </span>
                </div>
                {data.tickets.cancelledCount > 0 && (
                  <p className="mb-2 text-xs text-red-600">
                    Չեղարկված այսօր՝ {data.tickets.cancelledCount} (−
                    {formatAmd(data.tickets.cancelledRevenue)})
                  </p>
                )}
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Ֆիլմ</th>
                        <th className="px-4 py-3 text-right">Քանակ</th>
                        <th className="px-4 py-3 text-right">Եկամուտ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tickets.byMovie.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-6 text-center text-gray-500"
                          >
                            Այսօր տոմսեր չեն վաճառվել
                          </td>
                        </tr>
                      ) : (
                        data.tickets.byMovie.map((row) => (
                          <tr
                            key={row.movieTitle}
                            className="border-t border-gray-100"
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {row.movieTitle}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {row.count}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums text-purple-700">
                              {formatAmd(row.revenue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Package className="h-5 w-5 text-amber-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Ապրանքներ
                  </h3>
                  <span className="text-sm text-gray-500">
                    {data.products.soldUnits} միավոր · շահույթ{' '}
                    {formatAmd(data.products.netProfit)}
                  </span>
                </div>
                {data.products.returnedAmount > 0 && (
                  <p className="mb-2 text-xs text-red-600">
                    Վերադարձներ այսօր՝ −
                    {formatAmd(data.products.returnedAmount)}
                  </p>
                )}
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Ապրանք</th>
                        <th className="px-3 py-3 text-right">Քանակ</th>
                        <th className="px-3 py-3 text-right">Եկամուտ</th>
                        <th className="px-3 py-3 text-right">Ինքնաարժեք</th>
                        <th className="px-4 py-3 text-right">Շահույթ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.products.byProduct.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-6 text-center text-gray-500"
                          >
                            Այսօր ապրանքներ չեն վաճառվել
                          </td>
                        </tr>
                      ) : (
                        data.products.byProduct.map((row) => (
                          <tr
                            key={row.productId}
                            className={`border-t border-gray-100 ${
                              row.missingCost ? 'bg-amber-50/70' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {row.name}
                                </span>
                                {row.missingCost && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                                    Ինքնաարժեք չկա
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-gray-500">
                                {CATEGORY_LABELS[row.category] ?? row.category}
                                {row.withTicketQty > 0 &&
                                  ` · տոմսով ${row.withTicketQty}`}
                                {row.productOnlyQty > 0 &&
                                  ` · միայն ապրանք ${row.productOnlyQty}`}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {row.quantity}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatAmd(row.revenue)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                              {formatAmd(row.cost)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">
                              {formatAmd(row.profit)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
