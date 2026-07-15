'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Loader2,
  Minus,
  Plus,
  Popcorn,
  RotateCcw,
  ScanLine,
  Trash2,
  X,
} from 'lucide-react';
import PaymentPanel, {
  type PaymentMethod,
} from '@/components/admin/box-office-payment-panel';
import { isQuantityOnlyProduct } from '@/lib/product-units';
import type { ScanSaleProductItem, ScannedUnitLine } from '@/components/admin/product-scan-sale-modal';

interface ReturnedItem {
  qrCode: string;
  productName: string;
  price: number;
  orderId: number | null;
}

interface ReturnLookupResult {
  success: boolean;
  error?: string;
  item?: ReturnedItem;
}

interface SaleLookupResult {
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

type Mode = 'refund' | 'exchange';

interface ProductReturnExchangeModalProps {
  products: ScanSaleProductItem[];
  isSubmitting: boolean;
  error?: string | null;
  onClose: () => void;
  lookupReturn: (qrCode: string) => Promise<ReturnLookupResult>;
  lookupNewUnit: (qrCode: string) => Promise<SaleLookupResult>;
  onSubmit: (payload: {
    returnQrCode: string;
    mode: Mode;
    units: string[];
    popcorn: { productId: number; quantity: number }[];
    payment?: { method: PaymentMethod; amountPaid: number };
  }) => void;
}

export default function ProductReturnExchangeModal({
  products,
  isSubmitting,
  error,
  onClose,
  lookupReturn,
  lookupNewUnit,
  onSubmit,
}: ProductReturnExchangeModalProps) {
  const [returned, setReturned] = useState<ReturnedItem | null>(null);
  const [mode, setMode] = useState<Mode>('refund');
  const [returnInput, setReturnInput] = useState('');
  const [newScanInput, setNewScanInput] = useState('');
  const [returnBusy, setReturnBusy] = useState(false);
  const [newScanBusy, setNewScanBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedUnitLine[]>([]);
  const [popcornCart, setPopcornCart] = useState<Record<number, number>>({});
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<number | ''>('');

  const returnInputRef = useRef<HTMLInputElement>(null);
  const newScanInputRef = useRef<HTMLInputElement>(null);

  const popcornProducts = useMemo(
    () => products.filter((p) => isQuantityOnlyProduct(p.category)),
    [products]
  );

  const focusReturnInput = useCallback(() => {
    requestAnimationFrame(() => {
      returnInputRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const focusNewScanInput = useCallback(() => {
    requestAnimationFrame(() => {
      newScanInputRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => focusReturnInput(), 60);
    return () => clearTimeout(t);
  }, [focusReturnInput]);

  const newTotal = useMemo(() => {
    const unitsTotal = scanned.reduce((sum, u) => sum + u.price, 0);
    const popcornTotal = Object.entries(popcornCart).reduce((sum, [id, qty]) => {
      const product = popcornProducts.find((p) => p.id === Number(id));
      return sum + (product ? product.price * qty : 0);
    }, 0);
    return unitsTotal + popcornTotal;
  }, [scanned, popcornCart, popcornProducts]);

  const returnValue = returned?.price ?? 0;
  const netDue = mode === 'exchange' ? newTotal - returnValue : 0;
  const refundToCustomer =
    mode === 'refund' ? returnValue : netDue < 0 ? Math.abs(netDue) : 0;

  const cashOk =
    netDue <= 0 ||
    method === 'card' ||
    (cashReceived !== '' && Number(cashReceived) >= netDue);

  const canSubmit =
    !isSubmitting &&
    returned &&
    (mode === 'refund' ||
      (scanned.length > 0 ||
        Object.values(popcornCart).some((qty) => qty > 0))) &&
    cashOk;

  const handleReturnScan = async (raw: string) => {
    const code = raw.trim();
    if (!code || returnBusy) return;

    setReturnBusy(true);
    setLocalError(null);
    try {
      const result = await lookupReturn(code);
      if (result.success && result.item) {
        setReturned(result.item);
        setReturnInput('');
        if (mode === 'exchange') {
          focusNewScanInput();
        }
      } else {
        setLocalError(result.error || 'QR-ը չհաջողվեց գտնել');
      }
    } catch {
      setLocalError('QR-ը ստուգելիս սխալ է տեղի ունեցել');
    } finally {
      setReturnBusy(false);
      setReturnInput('');
      focusReturnInput();
    }
  };

  const handleNewScan = async (raw: string) => {
    const code = raw.trim();
    if (!code || newScanBusy || !returned) return;

    if (code === returned.qrCode) {
      setLocalError('Նոր ապրանքը չի կարող լինել նույն վերադարձվող QR-ը');
      setNewScanInput('');
      focusNewScanInput();
      return;
    }

    if (scanned.some((u) => u.qrCode === code)) {
      setLocalError(`QR «${code}» արդեն ավելացված է`);
      setNewScanInput('');
      focusNewScanInput();
      return;
    }

    setNewScanBusy(true);
    setLocalError(null);
    try {
      const result = await lookupNewUnit(code);
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
        setLocalError(result.error || 'QR-ը չհաջողվեց ավելացնել');
      }
    } catch {
      setLocalError('QR-ը ստուգելիս սխալ է տեղի ունեցել');
    } finally {
      setNewScanBusy(false);
      setNewScanInput('');
      focusNewScanInput();
    }
  };

  const setPopcornQty = (productId: number, qty: number) => {
    setPopcornCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };

  const resetReturned = () => {
    setReturned(null);
    setScanned([]);
    setPopcornCart({});
    setReturnInput('');
    setNewScanInput('');
    setLocalError(null);
    focusReturnInput();
  };

  const handleSubmit = () => {
    if (!canSubmit || !returned) return;
    onSubmit({
      returnQrCode: returned.qrCode,
      mode,
      units: scanned.map((u) => u.qrCode),
      popcorn: Object.entries(popcornCart).map(([id, qty]) => ({
        productId: Number(id),
        quantity: qty,
      })),
      payment:
        mode === 'exchange' && netDue > 0
          ? { method, amountPaid: Number(cashReceived || netDue) }
          : undefined,
    });
  };

  const displayError = localError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <RotateCcw className="h-5 w-5 text-sky-600" />
              Վերադարձ / Փոխանակում
            </h2>
            <p className="text-sm text-gray-500">
              Սկանավորեք վաճառված ապրանքի QR-ը, ապա վերադարձեք կամ փոխարինեք
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {displayError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {displayError}
            </div>
          )}

          {!returned ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Վերադարձվող ապրանքի QR
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={returnInputRef}
                    value={returnInput}
                    onChange={(e) => setReturnInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleReturnScan(returnInput);
                      }
                    }}
                    placeholder="Սկանավորեք վաճառված ապրանքի QR-ը"
                    disabled={returnBusy || isSubmitting}
                    className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <button
                  type="button"
                  disabled={returnBusy || isSubmitting || !returnInput.trim()}
                  onClick={() => void handleReturnScan(returnInput)}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {returnBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ստուգել'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                      Վերադարձվող ապրանք
                    </p>
                    <p className="mt-1 text-lg font-bold text-gray-900">
                      {returned.productName}
                    </p>
                    <p className="text-sm text-gray-600">QR: {returned.qrCode}</p>
                    {returned.orderId && (
                      <p className="text-sm text-gray-500">
                        Պատվեր #{returned.orderId}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Վերադարձի գումար</p>
                    <p className="text-xl font-extrabold text-sky-700">
                      {returned.price.toLocaleString()} ֏
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetReturned}
                  disabled={isSubmitting}
                  className="mt-3 text-xs font-semibold text-sky-700 hover:text-sky-900"
                >
                  Փոխել QR-ը
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setMode('refund')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                    mode === 'refund'
                      ? 'border-sky-500 bg-sky-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-sky-300'
                  }`}
                >
                  <RotateCcw className="h-4 w-4" />
                  Միայն վերադարձ
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setMode('exchange');
                    focusNewScanInput();
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                    mode === 'exchange'
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300'
                  }`}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Փոխանակում
                </button>
              </div>

              {mode === 'exchange' && (
                <div className="space-y-4 rounded-xl border border-gray-200 p-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Նոր ապրանքի QR
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          ref={newScanInputRef}
                          value={newScanInput}
                          onChange={(e) => setNewScanInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleNewScan(newScanInput);
                            }
                          }}
                          placeholder="Սկանավորեք նոր ապրանքի QR-ը"
                          disabled={newScanBusy || isSubmitting}
                          className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={newScanBusy || isSubmitting || !newScanInput.trim()}
                        onClick={() => void handleNewScan(newScanInput)}
                        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50"
                      >
                        {newScanBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Ավելացնել'
                        )}
                      </button>
                    </div>
                  </div>

                  {scanned.length > 0 && (
                    <div className="space-y-2">
                      {scanned.map((item) => (
                        <div
                          key={item.qrCode}
                          className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500">{item.qrCode}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">
                              {item.price.toLocaleString()} ֏
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setScanned((prev) =>
                                  prev.filter((u) => u.qrCode !== item.qrCode)
                                )
                              }
                              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {popcornProducts.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        <Popcorn className="h-3.5 w-3.5" />
                        Քանակով ապրանքներ
                      </p>
                      {popcornProducts.map((product) => {
                        const qty = popcornCart[product.id] ?? 0;
                        return (
                          <div
                            key={product.id}
                            className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {product.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {product.price.toLocaleString()} ֏ · առկա {product.stock}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPopcornQty(product.id, Math.max(0, qty - 1))
                                }
                                className="rounded-lg border border-gray-200 p-1 hover:bg-gray-50"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-6 text-center text-sm font-bold">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setPopcornQty(
                                    product.id,
                                    Math.min(product.stock, qty + 1)
                                  )
                                }
                                className="rounded-lg border border-gray-200 p-1 hover:bg-gray-50"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                {mode === 'refund' ? (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">
                      Վերադարձ հաճախորդին
                    </span>
                    <span className="text-lg font-extrabold text-sky-700">
                      {refundToCustomer.toLocaleString()} ֏
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Վերադարձվող ապրանք</span>
                      <span className="font-semibold text-gray-900">
                        −{returnValue.toLocaleString()} ֏
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Նոր ապրանք</span>
                      <span className="font-semibold text-gray-900">
                        +{newTotal.toLocaleString()} ֏
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-2">
                      {netDue > 0 ? (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">
                            Լրացուցիչ վճարում
                          </span>
                          <span className="text-lg font-extrabold text-amber-700">
                            {netDue.toLocaleString()} ֏
                          </span>
                        </div>
                      ) : netDue < 0 ? (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">
                            Վերադարձ հաճախորդին
                          </span>
                          <span className="text-lg font-extrabold text-sky-700">
                            {Math.abs(netDue).toLocaleString()} ֏
                          </span>
                        </div>
                      ) : (
                        <p className="text-center font-medium text-emerald-700">
                          Հավասար փոխանակում — լրացուցիչ գումար չկա
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {mode === 'exchange' && netDue > 0 && (
                <PaymentPanel
                  total={netDue}
                  method={method}
                  setMethod={setMethod}
                  cashReceived={cashReceived}
                  setCashReceived={setCashReceived}
                  accent="amber"
                  disabled={isSubmitting}
                />
              )}
            </>
          )}
        </div>

        <div className="border-t border-gray-100 bg-white p-4">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Կատարվում է...
              </>
            ) : mode === 'refund' ? (
              <>
                <RotateCcw className="h-4 w-4" />
                Հաստատել վերադարձը
              </>
            ) : (
              <>
                <ArrowLeftRight className="h-4 w-4" />
                Հաստատել փոխանակումը
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
