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
} from 'lucide-react';
import {
  getProductDemandAnalytics,
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

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('hy-AM', {
    month: 'short',
    day: 'numeric',
  });
}

function formatFullDate(value: string) {
  return new Date(value).toLocaleDateString('hy-AM', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function weekdayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString('hy-AM', { weekday: 'short' });
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
    if (!data) return 1;
    return Math.max(
      1,
      ...data.dailySales.map((point) =>
        Math.max(point.soldAtCounter, point.fulfilledAtEntry)
      )
    );
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
            <div key={item} className="h-24 animate-pulse rounded-xl bg-gray-100" />
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

  return (
    <div className="mb-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Պահանջարկի վերլուծություն
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Վերջին 7 օրվա վաճառք՝ այս պահից հետ։ Պատվերը՝ չորեքշաբթի, ստացում՝
            հինգշաբթի։
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

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: 'Վերլուծության ժամանակ',
            value: `${formatShortDate(data.periodStart)} — ${formatShortDate(data.periodEnd)}`,
            icon: CalendarClock,
            color: 'from-blue-500 to-cyan-500',
          },
          {
            title: 'Հաջորդ պատվեր',
            value:
              data.daysUntilOrder === 0
                ? 'Այսօր (չորեքշաբթի)'
                : `${formatFullDate(data.nextOrderDate)} (${data.daysUntilOrder} օր)`,
            icon: ShoppingCart,
            color: 'from-purple-500 to-pink-500',
          },
          {
            title: 'Կանխատեսման գործակից',
            value: `×${data.coefficient.toLocaleString('hy-AM')}`,
            icon: TrendingUp,
            color: 'from-emerald-500 to-green-500',
          },
          {
            title: 'Ցուցադրություններ / տոմսեր',
            value: `${data.pastScreenings} → ${data.upcomingScreenings} · ${data.pastTicketsSold} → ${data.upcomingTicketsSold + data.upcomingTicketsReserved}`,
            icon: Film,
            color: 'from-amber-500 to-orange-500',
          },
        ].map((card, index) => (
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
            <p className="mt-1 text-lg font-bold text-gray-900">{card.value}</p>
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
            const soldHeight = (point.soldAtCounter / chartMax) * 100;
            const fulfilledHeight = (point.fulfilledAtEntry / chartMax) * 100;
            return (
              <div key={point.date} className="flex flex-col items-center">
                <div className="flex h-40 w-full items-end justify-center gap-1">
                  <div
                    className="w-3 rounded-t bg-purple-500"
                    style={{ height: `${Math.max(soldHeight, 4)}%` }}
                    title={`Դրամարկղ՝ ${point.soldAtCounter}`}
                  />
                  <div
                    className="w-3 rounded-t bg-emerald-500"
                    style={{ height: `${Math.max(fulfilledHeight, 4)}%` }}
                    title={`Մուտք՝ ${point.fulfilledAtEntry}`}
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
            Վաճառք (դրամարկղ/օնլայն)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-emerald-500" />
            Մուտք (պահեստից հանված)
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
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-3">Ապրանք</th>
                <th className="px-4 py-3">Կատեգորիա</th>
                <th className="px-4 py-3 text-right">Վաճառք</th>
                <th className="px-4 py-3 text-right">Մուտք</th>
                <th className="px-4 py-3 text-right">Պաշար</th>
                <th className="px-4 py-3 text-right">Կանխատեսում</th>
                <th className="px-6 py-3 text-right">Պատվիրել</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr
                  key={product.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {CATEGORY_LABELS[product.category] ?? product.category}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {product.soldAtCounter}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {product.fulfilledAtEntry}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {product.stock}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {product.forecastDemand}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span
                      className={`inline-flex min-w-10 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        product.suggestedOrder > 0
                          ? 'bg-purple-100 text-purple-700'
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
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Վերջին շաբաթ — ըստ ֆիլմերի
          </h3>
          <div className="space-y-3">
            {data.movieBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500">
                Ֆիլմերի վաճառքի տվյալներ չկան
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
                        {movie.screeningCount} ցուցադրություն ·{' '}
                        {movie.ticketsSold} տոմս
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      <p>Վաճառք՝ {movie.soldAtCounter}</p>
                      <p>Մուտք՝ {movie.fulfilledAtEntry}</p>
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
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Առաջիկա շաբաթ — կանխատեսում
          </h3>
          <div className="space-y-3">
            {data.upcomingMovies.length === 0 ? (
              <p className="text-sm text-gray-500">
                Առաջիկա 7 օրվա ցուցադրություններ չկան
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
                        setExpandedMovieId(
                          isExpanded ? null : movie.movieId
                        )
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
                          {movie.ticketsReserved} ամրագրված
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-purple-700">
                        <span>×{movie.coefficient}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
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
                                  {product.pastQuantity} →{' '}
                                  <strong className="text-purple-700">
                                    {product.forecastQuantity}
                                  </strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-gray-500">
                            Այս ֆիլմի նախորդ վաճառքի տվյալներ չկան
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
