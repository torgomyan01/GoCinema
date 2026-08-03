'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  TrendingUp,
  CalendarClock,
  Film,
  Download,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  BarChart3,
  AlertTriangle,
  Truck,
} from 'lucide-react';
import {
  getProductDemandAnalytics,
  type DemandConfidence,
  type ProductDemandAnalytics,
} from '@/app/actions/product-demand';
import { openProductDemandOrderPdf } from '@/lib/product-demand-order-pdf';

const CATEGORY_LABELS: Record<string, string> = {
  snack: 'Նախուտեստ',
  drink: 'Խմիչք',
  combo: 'Կոմբո',
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

const CONFIDENCE_LABELS: Record<DemandConfidence, string> = {
  high: 'Բարձր',
  medium: 'Միջին',
  low: 'Ցածր',
};

const CONFIDENCE_STYLES: Record<DemandConfidence, string> = {
  high: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('hy-AM', {
    month: 'short',
    day: 'numeric',
  });
}

function formatFullDate(value: string) {
  return new Date(value).toLocaleDateString('hy-AM', {
    month: 'long',
    day: 'numeric',
  });
}

function weekdayLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('hy-AM', {
    weekday: 'short',
  });
}

export default function ProductDemandSection() {
  const [data, setData] = useState<ProductDemandAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMovieId, setExpandedMovieId] = useState<number | null>(null);
  const [showAllProducts, setShowAllProducts] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getProductDemandAnalytics();
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error ?? 'Տվյալները բեռնել չհաջողվեց');
        }
      } catch {
        setError('Տվյալները բեռնելիս սխալ է տեղի ունեցել');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const chartMax = useMemo(() => {
    if (!data) return { consumption: 1, tickets: 1 };
    return {
      consumption: Math.max(
        1,
        ...data.dailySales.map((point) => point.consumption)
      ),
      tickets: Math.max(1, ...data.dailySales.map((point) => point.tickets)),
    };
  }, [data]);

  const visibleProducts = useMemo(() => {
    if (!data) return [];
    return showAllProducts ? data.products : data.products.slice(0, 12);
  }, [data, showAllProducts]);

  const handleOrderPdf = () => {
    if (!data) return;
    const ok = openProductDemandOrderPdf(data);
    if (!ok) {
      alert('Չհաջողվեց բացել PDF պատուհանը։ Ստուգեք popup-ի արգելափակումը։');
    }
  };

  if (isLoading) {
    return (
      <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
        <div className="mt-6 h-56 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error ?? 'Տվյալներ չկան'}
      </div>
    );
  }

  const summaryCards = [
    {
      title: 'Վերլուծություն',
      value: `${data.historyDays} օր պատմություն`,
      hint: `${formatShortDate(data.periodStart)} — ${formatShortDate(data.periodEnd)} ցուցադրված`,
      icon: CalendarClock,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Պատվեր / ստացում',
      value:
        data.daysUntilOrder === 0
          ? 'Այսօր → վաղը'
          : `${formatFullDate(data.nextOrderDate)} → ${formatFullDate(data.deliveryDate)}`,
      hint: `Ծածկում ${data.coverDays} օր (մինչև հաջորդ մատակարարում)`,
      icon: Truck,
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Պահուստ',
      value: `+${Math.round(data.safetyBufferPct * 100)}%`,
      hint: `Սպասարկման մակարդակ ~95% (z=${data.serviceZ})`,
      icon: Package,
      color: 'from-emerald-500 to-green-500',
    },
    {
      title: 'Սպասվող տոմսեր',
      value: data.coverExpectedTickets.toLocaleString('hy-AM'),
      hint: `${data.coverScreenings} ցուցադրություն · պատմություն ${data.historyTickets} տոմս`,
      icon: Film,
      color: 'from-amber-500 to-orange-500',
    },
    {
      title: 'Պատվերի ցանկ',
      value: `${data.totals.orderUnits.toLocaleString('hy-AM')} միավոր`,
      hint: `${data.totals.orderProductCount} ապրանք · ${data.totals.criticalCount} կրիտիկական`,
      icon: ShoppingCart,
      color: 'from-rose-500 to-red-500',
    },
  ];

  return (
    <div className="mb-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Պահանջարկի վերլուծություն և պատվեր
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Սպառումը հաշվարկվում է մեկ տոմսի հաշվով (attach rate) ըստ ֆիլմերի,
            ապա կանխատեսվում է առաջիկա ցուցադրությունների համար։ Պատվերը ծածկում
            է մինչև հաջորդ մատակարարումը՝ +
            {Math.round(data.safetyBufferPct * 100)}% պահուստով։
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOrderPdf}
            disabled={data.orderList.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart className="h-4 w-4" />
            Պատվիրել ({data.orderList.length})
          </button>
          <button
            type="button"
            onClick={handleOrderPdf}
            disabled={data.orderList.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {data.totals.scheduleMissing && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Առաջիկա {data.coverDays} օրվա ցուցադրությունները դեռ ավելացված չեն։
            Կանխատեսումը կատարվում է պատմական օրական ռիթմով։ Ժամանակացույցը
            լրացնելուց հետո թվերը կճշգրտվեն։
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-xl bg-white p-5 shadow-lg"
          >
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r ${card.color}`}
            >
              <card.icon className="h-5 w-5 text-white" />
            </div>
            <p className="text-sm text-gray-600">{card.title}</p>
            <p className="mt-1 text-base font-bold text-gray-900">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-gray-500">{card.hint}</p>
          </motion.div>
        ))}
      </div>

      <div className="mb-6 rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Շաբաթական դինամիկա
          </h3>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {data.dailySales.map((point) => {
            const consumptionHeight =
              (point.consumption / chartMax.consumption) * 100;
            const ticketsHeight = (point.tickets / chartMax.tickets) * 100;
            return (
              <div key={point.date} className="flex flex-col items-center">
                <div className="flex h-40 w-full items-end justify-center gap-1">
                  <div
                    className="w-3 rounded-t bg-purple-500"
                    style={{ height: `${Math.max(consumptionHeight, 3)}%` }}
                    title={`Սպառում՝ ${point.consumption}`}
                  />
                  <div
                    className="w-3 rounded-t bg-sky-400"
                    style={{ height: `${Math.max(ticketsHeight, 3)}%` }}
                    title={`Տոմսեր՝ ${point.tickets}`}
                  />
                </div>
                <p className="mt-2 text-xs font-medium text-gray-700">
                  {weekdayLabel(point.date)}
                </p>
                <p className="text-[11px] text-gray-500">
                  {formatShortDate(point.date)}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-purple-500" />
            Ապրանքի սպառում
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-sky-400" />
            Վաճառված տոմսեր
          </span>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Ապրանքների պահանջարկ
            </h3>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Թիրախ = սպասվող սպառում ({data.coverDays} օր) + պահուստ։ Պատվեր =
            թիրախ − հասանելի պաշար։
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-3">Ապրանք</th>
                <th className="px-3 py-3 text-right">7 օր</th>
                <th className="px-3 py-3 text-right">Օրական</th>
                <th className="px-3 py-3 text-right">/100 տոմս</th>
                <th className="px-3 py-3 text-right">Հասանելի</th>
                <th className="px-3 py-3 text-right">Հերիքում է</th>
                <th className="px-3 py-3 text-right">Սպասվող</th>
                <th className="px-3 py-3 text-right">Պահուստ</th>
                <th className="px-3 py-3 text-right">Թիրախ</th>
                <th className="px-6 py-3 text-right">Պատվիրել</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr
                  key={product.id}
                  className={`border-t border-gray-100 hover:bg-gray-50 ${
                    product.isCritical ? 'bg-red-50/60' : ''
                  }`}
                >
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {product.name}
                      </span>
                      {product.isCritical && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                          Սպառվում է
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONFIDENCE_STYLES[product.confidence]}`}
                        title="Տվյալների վստահելիություն"
                      >
                        {CONFIDENCE_LABELS[product.confidence]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {CATEGORY_LABELS[product.category] ?? product.category}
                      {product.committed > 0 &&
                        ` · ${product.committed} ամրագրված`}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {product.soldLast7}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                    {product.avgDaily.toLocaleString('hy-AM')}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                    {product.attachPer100Tickets.toLocaleString('hy-AM')}
                  </td>
                  <td
                    className={`px-3 py-3 text-right font-semibold tabular-nums ${
                      product.isCritical ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {product.available}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                    {product.daysOfStock === null
                      ? '—'
                      : `${product.daysOfStock.toLocaleString('hy-AM')} օր`}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {product.expectedDemand}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                    +{product.safetyStock}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">
                    {product.targetStock}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span
                      className={`inline-flex min-w-10 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        product.suggestedOrder > 0
                          ? product.isCritical
                            ? 'bg-red-100 text-red-700'
                            : 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {product.suggestedOrder}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.products.length > 12 && (
          <div className="border-t border-gray-100 px-6 py-3">
            <button
              type="button"
              onClick={() => setShowAllProducts((value) => !value)}
              className="text-sm font-medium text-purple-600 hover:text-purple-500"
            >
              {showAllProducts
                ? 'Ցույց տալ քիչ'
                : `Ցույց տալ բոլորը (${data.products.length})`}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900">
            Ֆիլմերի սպառման պատկեր
          </h3>
          <p className="mb-4 mt-1 text-xs text-gray-500">
            Վերջին {data.historyDays} օրը՝ քանի ապրանք է սպառվել մեկ տոմսի
            հաշվով
          </p>
          <div className="space-y-3">
            {data.movieBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500">
                Ֆիլմերի սպառման տվյալներ չկան
              </p>
            ) : (
              data.movieBreakdown.slice(0, 8).map((movie) => (
                <div
                  key={movie.movieId}
                  className="rounded-xl border border-gray-100 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {movie.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {movie.screeningCount} ցուցադրություն · {movie.tickets}{' '}
                        տոմս
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-purple-700">
                        {movie.perTicket.toLocaleString('hy-AM')} / տոմս
                      </p>
                      <p className="text-xs text-gray-500">
                        {movie.consumption} միավոր
                      </p>
                    </div>
                  </div>
                  {movie.topProducts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {movie.topProducts.slice(0, 4).map((product) => (
                        <span
                          key={product.productId}
                          className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                        >
                          {product.name} ×{product.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900">
            Առաջիկա ցուցադրությունների կանխատեսում
          </h3>
          <p className="mb-4 mt-1 text-xs text-gray-500">
            Սպասվող տոմսեր × ֆիլմի attach rate = ապրանքի պահանջարկ
          </p>
          <div className="space-y-3">
            {data.upcomingMovies.length === 0 ? (
              <p className="text-sm text-gray-500">
                Առաջիկա {data.coverDays} օրվա ցուցադրություններ չկան
              </p>
            ) : (
              data.upcomingMovies.map((movie) => {
                const isExpanded = expandedMovieId === movie.movieId;
                return (
                  <div
                    key={movie.movieId}
                    className="rounded-xl border border-gray-100"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMovieId(isExpanded ? null : movie.movieId)
                      }
                      className="flex w-full items-start justify-between gap-3 p-4 text-left"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">
                          {movie.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {movie.screeningCount} ցուցադրություն ·{' '}
                          {movie.ticketsSold} վաճառված ·{' '}
                          {movie.ticketsPending} ամրագրված
                        </p>
                        {movie.pastScreenings > 0 && (
                          <p className="text-xs text-gray-400">
                            Պատմություն՝ {movie.pastScreenings} ցուցադրություն /{' '}
                            {movie.pastTickets} տոմս
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-purple-700">
                          ~{movie.expectedTickets} տոմս
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 pb-4">
                        {movie.topProducts.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {movie.topProducts.map((product) => (
                              <div
                                key={product.productId}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-gray-700">
                                  {product.name}
                                </span>
                                <span className="tabular-nums text-gray-500">
                                  {product.per100Tickets.toLocaleString(
                                    'hy-AM'
                                  )}
                                  /100 տոմս →{' '}
                                  <strong className="text-purple-700">
                                    {product.forecastQuantity}
                                  </strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                            <TrendingUp className="h-4 w-4" />
                            Այս ֆիլմի ապրանքային պատմություն դեռ չկա
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
