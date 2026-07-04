'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  QrCode,
  Search,
  RefreshCw,
  Package,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import AdminLayout from './admin-layout';
import {
  getProductUnitsHistory,
  setProductUnitPekReported,
  type ProductUnitsHistoryStatus,
} from '@/app/actions/products';

interface AdminProductUnitsClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface HistoryUnit {
  id: number;
  qrCode: string;
  status: string;
  soldAt: Date | string | null;
  verifiedAt: Date | string | null;
  pekReportedAt: Date | string | null;
  createdAt: Date | string;
  orderItemId: number | null;
  product: {
    id: number;
    name: string;
    category: string;
    price: number;
  };
  orderItem: {
    id: number;
    orderId: number;
    price: number;
  } | null;
}

const MONTHS = [
  'հունվ',
  'փետ',
  'մարտ',
  'ապր',
  'մայիս',
  'հունիս',
  'հուլիս',
  'օգոս',
  'սեպ',
  'հոկ',
  'նոյ',
  'դեկ',
];

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.getDate();
  const month = MONTHS[d.getMonth()] ?? '';
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

export default function AdminProductUnitsClient({
  user,
}: AdminProductUnitsClientProps) {
  const [units, setUnits] = useState<HistoryUnit[]>([]);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [inStock, setInStock] = useState(0);
  const [sold, setSold] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<ProductUnitsHistoryStatus>('all');
  const [productId, setProductId] = useState<number | 'all'>('all');

  const [previewUnit, setPreviewUnit] = useState<HistoryUnit | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pekSavingId, setPekSavingId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, productId]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProductUnitsHistory({
        search: debouncedSearch || undefined,
        status: statusFilter,
        productId: productId === 'all' ? undefined : productId,
        page,
        pageSize,
      });

      if (!result.success) {
        setError(result.error || 'Բեռնման սխալ');
        setUnits([]);
        setTotal(0);
        return;
      }

      setUnits(result.units as HistoryUnit[]);
      setProducts(result.products);
      setInStock(result.inStock);
      setSold(result.sold);
      setTotal(result.total);
    } catch (err) {
      console.error('[Admin Product Units] load error:', err);
      setError('Պատմությունը բեռնելիս սխալ է տեղի ունեցել');
      setUnits([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, productId, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const copyQr = async (unit: HistoryUnit) => {
    try {
      await navigator.clipboard.writeText(unit.qrCode);
      setCopiedId(unit.id);
      setTimeout(() => setCopiedId((id) => (id === unit.id ? null : id)), 1500);
    } catch {
      /* ignore */
    }
  };

  const togglePekReported = async (unit: HistoryUnit, reported: boolean) => {
    const previous = unit.pekReportedAt;
    setPekSavingId(unit.id);
    setError(null);

    // Optimistic update — միավորը մնում է ցանկում
    setUnits((list) =>
      list.map((u) =>
        u.id === unit.id
          ? { ...u, pekReportedAt: reported ? previous ?? new Date() : null }
          : u
      )
    );
    setPreviewUnit((current) =>
      current?.id === unit.id
        ? {
            ...current,
            pekReportedAt: reported ? previous ?? new Date() : null,
          }
        : current
    );

    try {
      const result = await setProductUnitPekReported(unit.id, reported);
      if (!result.success) {
        setUnits((list) =>
          list.map((u) =>
            u.id === unit.id ? { ...u, pekReportedAt: previous } : u
          )
        );
        setPreviewUnit((current) =>
          current?.id === unit.id
            ? { ...current, pekReportedAt: previous }
            : current
        );
        setError(result.error || 'ՊԵԿ կարգավիճակը չփոխվեց');
        return;
      }

      setUnits((list) =>
        list.map((u) =>
          u.id === unit.id
            ? { ...u, pekReportedAt: result.pekReportedAt ?? null }
            : u
        )
      );
      setPreviewUnit((current) =>
        current?.id === unit.id
          ? { ...current, pekReportedAt: result.pekReportedAt ?? null }
          : current
      );
    } catch {
      setUnits((list) =>
        list.map((u) =>
          u.id === unit.id ? { ...u, pekReportedAt: previous } : u
        )
      );
      setPreviewUnit((current) =>
        current?.id === unit.id
          ? { ...current, pekReportedAt: previous }
          : current
      );
      setError('ՊԵԿ կարգավիճակը փոխելիս սխալ է տեղի ունեցել');
    } finally {
      setPekSavingId(null);
    }
  };

  return (
    <AdminLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <QrCode className="w-7 h-7 text-amber-600" />
              Ապրանքների QR պատմություն
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Առկա և վաճառված միավորներ՝ նույն QR կոդով, ինչ ապրանքի վրա
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Թարմացնել
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Առկա</p>
              <p className="text-xl font-bold text-gray-900">{inStock}</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Վաճառված</p>
              <p className="text-xl font-bold text-gray-900">{sold}</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Ընդամենը (ֆիլտրով)</p>
              <p className="text-xl font-bold text-gray-900">{total}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Որոնել QR տեքստով…"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ProductUnitsHistoryStatus)
            }
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            <option value="all">Բոլոր կարգավիճակները</option>
            <option value="in_stock">Առկա</option>
            <option value="sold">Վաճառված</option>
          </select>
          <select
            value={productId === 'all' ? 'all' : String(productId)}
            onChange={(e) =>
              setProductId(
                e.target.value === 'all' ? 'all' : Number(e.target.value)
              )
            }
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 min-w-[180px]"
          >
            <option value="all">Բոլոր ապրանքները</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Բեռնվում է…
            </div>
          ) : units.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">
              Միավորներ չեն գտնվել
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">QR</th>
                    <th className="px-4 py-3">QR տեքստ</th>
                    <th className="px-4 py-3">ՊԵԿ</th>
                    <th className="px-4 py-3">Ապրանք</th>
                    <th className="px-4 py-3">Կարգավիճակ</th>
                    <th className="px-4 py-3">Ավելացվել է</th>
                    <th className="px-4 py-3">Վաճառվել է</th>
                    <th className="px-4 py-3">Պատվեր</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {units.map((unit) => {
                    const pekOn = Boolean(unit.pekReportedAt);
                    const pekBusy = pekSavingId === unit.id;

                    return (
                      <tr
                        key={unit.id}
                        className={`hover:bg-gray-50/80 ${
                          pekOn ? 'bg-slate-50/80' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setPreviewUnit(unit)}
                            className="p-1.5 bg-white border border-gray-200 rounded-lg hover:border-amber-400 hover:shadow-sm transition-all"
                            title="Մեծացնել QR"
                          >
                            <QRCodeSVG
                              value={unit.qrCode}
                              size={56}
                              level="M"
                              includeMargin={false}
                              bgColor="#ffffff"
                              fgColor="#111827"
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 max-w-[220px]">
                            <code className="font-mono text-xs text-gray-800 break-all">
                              {unit.qrCode}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyQr(unit)}
                              className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                              title="Պատճենել"
                            >
                              {copiedId === unit.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 min-w-[140px]">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                              <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                                <input
                                  type="checkbox"
                                  role="switch"
                                  className="peer sr-only"
                                  checked={pekOn}
                                  disabled={pekBusy}
                                  onChange={(e) =>
                                    togglePekReported(unit, e.target.checked)
                                  }
                                  aria-label="ՊԵԿ ուղարկված"
                                />
                                <span
                                  className={`absolute inset-0 rounded-full transition-colors ${
                                    pekOn ? 'bg-slate-700' : 'bg-gray-200'
                                  } ${pekBusy ? 'opacity-60' : ''}`}
                                />
                                <span
                                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                    pekOn ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  pekOn ? 'text-slate-800' : 'text-gray-500'
                                }`}
                              >
                                {pekBusy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : pekOn ? (
                                  'Դուրս'
                                ) : (
                                  'Շրջանառության մեջ'
                                )}
                              </span>
                            </label>
                            {pekOn && (
                              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                                {formatDate(unit.pekReportedAt)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {unit.product.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {unit.product.price.toLocaleString('hy-AM')} ֏
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {unit.status === 'sold' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 w-fit">
                                Վաճառված
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 w-fit">
                                Առկա
                              </span>
                            )}
                            {pekOn && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700 w-fit">
                                ՊԵԿ · դուրս
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {formatDate(unit.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {formatDate(unit.soldAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {unit.orderItem?.orderId
                            ? `#${unit.orderItem.orderId}`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && total > pageSize && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">
                Էջ {page} / {totalPages} · {total} միավոր
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Նախորդ
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 disabled:opacity-40"
                >
                  Հաջորդ
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {previewUnit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setPreviewUnit(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewUnit(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-semibold text-gray-900 pr-8 mb-1">
              {previewUnit.product.name}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {previewUnit.status === 'sold' ? 'Վաճառված' : 'Առկա'}
              {previewUnit.orderItem?.orderId
                ? ` · Պատվեր #${previewUnit.orderItem.orderId}`
                : ''}
              {previewUnit.pekReportedAt
                ? ' · ՊԵԿ · շրջանառությունից դուրս'
                : ''}
            </p>
            <div className="flex justify-center p-4 bg-white border border-gray-200 rounded-xl">
              <QRCodeSVG
                value={previewUnit.qrCode}
                size={220}
                level="M"
                includeMargin
                bgColor="#ffffff"
                fgColor="#111827"
              />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 font-mono text-xs text-gray-800 break-all bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                {previewUnit.qrCode}
              </code>
              <button
                type="button"
                onClick={() => copyQr(previewUnit)}
                className="shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                {copiedId === previewUnit.id ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-600" />
                )}
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">ՊԵԿ ուղարկված</p>
                <p className="text-xs text-gray-500">
                  {previewUnit.pekReportedAt
                    ? `Դուրս · ${formatDate(previewUnit.pekReportedAt)}`
                    : 'Շրջանառության մեջ'}
                </p>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                  <input
                    type="checkbox"
                    role="switch"
                    className="peer sr-only"
                    checked={Boolean(previewUnit.pekReportedAt)}
                    disabled={pekSavingId === previewUnit.id}
                    onChange={(e) =>
                      togglePekReported(previewUnit, e.target.checked)
                    }
                    aria-label="ՊԵԿ ուղարկված"
                  />
                  <span
                    className={`absolute inset-0 rounded-full transition-colors ${
                      previewUnit.pekReportedAt
                        ? 'bg-slate-700'
                        : 'bg-gray-200'
                    }`}
                  />
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      previewUnit.pekReportedAt
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
