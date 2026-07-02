'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Minus,
  Plus,
  Popcorn,
  ScanLine,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import PaymentPanel, {
  type PaymentMethod,
} from '@/components/admin/box-office-payment-panel';
import { isQuantityOnlyProduct } from '@/lib/product-units';

export interface ScanSaleProductItem {
  id: number;
  name: string;
  price: number;
  category: string;
  image?: string | null;
  stock: number;
}

export interface ScannedUnitLine {
  qrCode: string;
  productId: number;
  name: string;
  price: number;
}

export type ScanSaleMode = 'standalone' | 'ticket-paid' | 'ticket-unpaid';

interface LookupResult {
  success: boolean;
  error?: string;
  unit?: {
    id: number;
    qrCode: string;
    productId: number;
    name: string;
    price: number;
    category: string;
  };
}

interface ProductScanSaleModalProps {
  products: ScanSaleProductItem[];
  mode: ScanSaleMode;
  isSubmitting: boolean;
  error?: string | null;
  onClose: () => void;
  lookupUnit: (qrCode: string) => Promise<LookupResult>;
  onSubmit: (payload: {
    units: string[];
    popcorn: { productId: number; quantity: number }[];
    payment?: { method: PaymentMethod; amountPaid: number };
  }) => void;
  title?: string;
  subtitle?: string;
}

export default function ProductScanSaleModal({
  products,
  mode,
  isSubmitting,
  error,
  onClose,
  lookupUnit,
  onSubmit,
  title = 'Ապրանքների վաճառք',
  subtitle,
}: ProductScanSaleModalProps) {
  const requiresPayment = mode !== 'ticket-unpaid';

  const [scanned, setScanned] = useState<ScannedUnitLine[]>([]);
  const [popcornCart, setPopcornCart] = useState<Record<number, number>>({});
  const [scanInput, setScanInput] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<number | ''>('');

  const scanInputRef = useRef<HTMLInputElement>(null);

  const popcornProducts = useMemo(
    () => products.filter((p) => isQuantityOnlyProduct(p.category)),
    [products]
  );

  const focusScanInput = useCallback(() => {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => focusScanInput(), 60);
    const onWindowFocus = () => focusScanInput();
    window.addEventListener('focus', onWindowFocus);
    return () => {
      clearTimeout(t);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [focusScanInput]);

  const total = useMemo(() => {
    const unitsTotal = scanned.reduce((sum, u) => sum + u.price, 0);
    const popcornTotal = Object.entries(popcornCart).reduce(
      (sum, [id, qty]) => {
        const product = popcornProducts.find((p) => p.id === Number(id));
        return sum + (product ? product.price * qty : 0);
      },
      0
    );
    return unitsTotal + popcornTotal;
  }, [scanned, popcornCart, popcornProducts]);

  const itemCount = useMemo(
    () =>
      scanned.length +
      Object.values(popcornCart).reduce((sum, qty) => sum + qty, 0),
    [scanned, popcornCart]
  );

  const handleScan = async (raw: string) => {
    const code = raw.trim();
    if (!code || scanBusy) return;

    if (scanned.some((u) => u.qrCode === code)) {
      setScanError(`QR «${code}» արդեն ավելացված է`);
      setScanInput('');
      focusScanInput();
      return;
    }

    setScanBusy(true);
    setScanError(null);
    try {
      const result = await lookupUnit(code);
      if (result.success && result.unit) {
        const unit = result.unit;
        setScanned((prev) => [
          {
            qrCode: unit.qrCode,
            productId: unit.productId,
            name: unit.name,
            price: unit.price,
          },
          ...prev,
        ]);
      } else {
        setScanError(result.error || 'QR-ը չհաջողվեց ավելացնել');
      }
    } catch {
      setScanError('QR-ը ստուգելիս սխալ է տեղի ունեցել');
    } finally {
      setScanBusy(false);
      setScanInput('');
      focusScanInput();
    }
  };

  const removeScanned = (qrCode: string) => {
    setScanned((prev) => prev.filter((u) => u.qrCode !== qrCode));
    focusScanInput();
  };

  const setPopcornQty = (productId: number, qty: number) => {
    setPopcornCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };

  const clearAll = () => {
    setScanned([]);
    setPopcornCart({});
    focusScanInput();
  };

  const cashOk =
    !requiresPayment ||
    method === 'card' ||
    (cashReceived !== '' && Number(cashReceived) >= total);
  const canSubmit = !isSubmitting && itemCount > 0 && cashOk;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      units: scanned.map((u) => u.qrCode),
      popcorn: Object.entries(popcornCart).map(([id, qty]) => ({
        productId: Number(id),
        quantity: qty,
      })),
      payment: requiresPayment
        ? {
            method,
            amountPaid: method === 'cash' ? Number(cashReceived) : total,
          }
        : undefined,
    });
  };

  const submitLabel = requiresPayment ? 'Վաճառել' : 'Ավելացնել պատվերին';

  const resolvedSubtitle =
    subtitle ??
    (mode === 'ticket-unpaid'
      ? 'Ավելանում է պատվերին, վճարումը՝ դրամարկղում միասին'
      : 'Սկանավորեք ապրանքի QR-ը, պոպկորնը՝ ձեռքով');

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-purple-200 bg-purple-600 px-4 py-3 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/20 p-2">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight sm:text-xl">
              {title}
            </h2>
            <p className="text-xs text-purple-50 sm:text-sm">
              {resolvedSubtitle}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium transition hover:bg-white/25 disabled:opacity-40"
        >
          <X className="h-5 w-5" />
          <span className="hidden sm:inline">Փակել</span>
        </button>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col lg:flex-row"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.tagName === 'INPUT' ||
            target.tagName === 'BUTTON' ||
            target.closest('button')
          ) {
            return;
          }
          focusScanInput();
        }}
      >
        {/* Ձախ՝ սկան + պոպկորն */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
            <label className="block text-sm font-semibold text-gray-700">
              Սկանավորեք ապրանքի QR կոդը
            </label>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                ref={scanInputRef}
                type="text"
                autoFocus
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onBlur={() => {
                  window.setTimeout(() => {
                    const active = document.activeElement;
                    if (
                      active instanceof HTMLInputElement ||
                      active instanceof HTMLButtonElement ||
                      active instanceof HTMLTextAreaElement
                    ) {
                      return;
                    }
                    focusScanInput();
                  }, 100);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleScan(scanInput);
                  }
                }}
                placeholder="Սկանավորեք կամ մուտքագրեք QR կոդը"
                className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-10 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
              {scanBusy && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-purple-600" />
              )}
            </div>
            {scanError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {scanError}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Ապարատային սկաները ավտոմատ ավելացնում է կոդը (Enter)։ Ամեն
              սկանավորում՝ մեկ միավոր։
            </p>
          </div>

          {popcornProducts.length > 0 && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                <Popcorn className="h-4 w-4" />
                Պոպկորն (ձեռքով քանակ)
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {popcornProducts.map((product) => {
                  const qty = popcornCart[product.id] || 0;
                  const outOfStock = product.stock <= 0;
                  const reachedMax = qty >= product.stock;
                  return (
                    <div
                      key={product.id}
                      className={`flex flex-col overflow-hidden rounded-2xl border bg-white transition ${
                        outOfStock
                          ? 'border-gray-200 opacity-60'
                          : qty > 0
                            ? 'border-purple-400 ring-2 ring-purple-200'
                            : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex flex-1 flex-col p-3">
                        <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                          {product.name}
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-purple-600">
                          {product.price.toLocaleString()} ֏
                        </p>
                        <p
                          className={`mt-0.5 text-xs ${
                            outOfStock ? 'text-red-500' : 'text-gray-400'
                          }`}
                        >
                          {outOfStock
                            ? 'Առկա չէ'
                            : `Մնացել է՝ ${product.stock}`}
                        </p>
                        <div className="mt-3">
                          {qty === 0 ? (
                            <button
                              type="button"
                              disabled={outOfStock}
                              onClick={() => setPopcornQty(product.id, 1)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-50 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                            >
                              <Plus className="h-4 w-4" />
                              Ավելացնել
                            </button>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPopcornQty(product.id, qty - 1)
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-100"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="text-base font-bold text-gray-900">
                                {qty}
                              </span>
                              <button
                                type="button"
                                disabled={reachedMax}
                                onClick={() =>
                                  setPopcornQty(product.id, qty + 1)
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-purple-100 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Աջ՝ զամբյուղ */}
        <aside className="flex max-h-[50vh] min-h-0 shrink-0 flex-col border-t border-gray-200 bg-white lg:max-h-none lg:w-[420px] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
              Զամբյուղ
              {itemCount > 0 && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
                  {itemCount}
                </span>
              )}
            </h3>
            {itemCount > 0 && (
              <button
                onClick={clearAll}
                disabled={isSubmitting}
                className="flex items-center gap-1 text-xs font-medium text-gray-400 transition hover:text-red-500 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Մաքրել
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {itemCount === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center text-gray-400">
                <ScanLine className="h-12 w-12" />
                <p className="text-sm">
                  Սկանավորեք ապրանք՝ վաճառքը սկսելու համար
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {scanned.map((unit) => (
                  <div
                    key={unit.qrCode}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-2.5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                      <ScanLine className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {unit.name}
                      </p>
                      <p className="truncate font-mono text-xs text-gray-500">
                        {unit.qrCode} · {unit.price.toLocaleString()} ֏
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeScanned(unit.qrCode)}
                      disabled={isSubmitting}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      title="Հեռացնել"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {Object.entries(popcornCart).map(([id, qty]) => {
                  const product = popcornProducts.find(
                    (p) => p.id === Number(id)
                  );
                  if (!product) return null;
                  return (
                    <div
                      key={`pc-${id}`}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-amber-50/50 p-2.5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                        <Popcorn className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {product.price.toLocaleString()} ֏ ×{' '}
                          <span className="font-semibold">{qty}</span> ={' '}
                          <span className="font-semibold text-amber-600">
                            {(product.price * qty).toLocaleString()} ֏
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPopcornQty(product.id, qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-100"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold text-gray-900">
                          {qty}
                        </span>
                        <button
                          type="button"
                          disabled={qty >= product.stock}
                          onClick={() => setPopcornQty(product.id, qty + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-amber-100 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
            {error && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-base font-semibold text-gray-700">
                Ընդհանուր
              </span>
              <span className="text-2xl font-extrabold text-purple-700">
                {total.toLocaleString()} ֏
              </span>
            </div>

            {requiresPayment && itemCount > 0 && (
              <div className="mb-3">
                <PaymentPanel
                  total={total}
                  method={method}
                  setMethod={setMethod}
                  cashReceived={cashReceived}
                  setCashReceived={setCashReceived}
                  accent="green"
                  disabled={isSubmitting}
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ShoppingBag className="h-5 w-5" />
              )}
              {submitLabel}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
