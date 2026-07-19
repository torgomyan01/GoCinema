'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CupSoda,
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
import {
  isQuantityOnlyProduct,
  parseQuantityProductName,
  quantityFlavorDisplayName,
  quantitySizeLabel,
  type QuantityProductSize,
} from '@/lib/product-units';

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
  // Վճարում միայն ինքնուրույն վաճառքի դեպքում (դրամարկղ)։
  // Տոմսին կապված երկու ռեժիմներում ապրանքները ավելանում են պատվերին։
  const requiresPayment = mode === 'standalone';
  const isTicketAttach = mode === 'ticket-paid' || mode === 'ticket-unpaid';

  const [scanned, setScanned] = useState<ScannedUnitLine[]>([]);
  const [popcornCart, setPopcornCart] = useState<Record<number, number>>({});
  const [scanInput, setScanInput] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<number | ''>('');
  /** null = երկու բլոկ, category = համերի ցանկ, flavor = չափի ընտրություն */
  const [pickerCategory, setPickerCategory] = useState<
    'popcorn' | 'iced_tea' | null
  >(null);
  const [pickerFlavorKey, setPickerFlavorKey] = useState<string | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);

  const popcornProducts = useMemo(
    () => products.filter((p) => isQuantityOnlyProduct(p.category)),
    [products]
  );

  const popcornByCategory = useMemo(() => {
    const popcorn = popcornProducts.filter((p) => p.category === 'popcorn');
    const icedTea = popcornProducts.filter((p) => p.category === 'iced_tea');
    return { popcorn, icedTea };
  }, [popcornProducts]);

  type FlavorGroup = {
    flavorKey: string;
    displayName: string;
    small: ScanSaleProductItem | null;
    large: ScanSaleProductItem | null;
  };

  const flavorGroupsFor = useCallback(
    (category: 'popcorn' | 'iced_tea'): FlavorGroup[] => {
      const list =
        category === 'popcorn'
          ? popcornByCategory.popcorn
          : popcornByCategory.icedTea;
      const map = new Map<string, FlavorGroup>();
      for (const product of list) {
        const { flavorKey, size } = parseQuantityProductName(product.name);
        const key = flavorKey || product.name;
        let group = map.get(key);
        if (!group) {
          group = {
            flavorKey: key,
            displayName: quantityFlavorDisplayName(key, category),
            small: null,
            large: null,
          };
          map.set(key, group);
        }
        if (size === 'small') group.small = product;
        else if (size === 'large') group.large = product;
        else {
          // Չափ չկա անվանումում — դիտարկենք որպես մեծ (մեկ տարբերակ)
          group.large = group.large ?? product;
        }
      }
      return Array.from(map.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'hy')
      );
    },
    [popcornByCategory]
  );

  const activeFlavorGroups = useMemo(
    () => (pickerCategory ? flavorGroupsFor(pickerCategory) : []),
    [pickerCategory, flavorGroupsFor]
  );

  const activeFlavorGroup = useMemo(
    () =>
      activeFlavorGroups.find((g) => g.flavorKey === pickerFlavorKey) ?? null,
    [activeFlavorGroups, pickerFlavorKey]
  );

  const flavorCartQty = useCallback(
    (group: FlavorGroup) => {
      let sum = 0;
      if (group.small) sum += popcornCart[group.small.id] || 0;
      if (group.large) sum += popcornCart[group.large.id] || 0;
      return sum;
    },
    [popcornCart]
  );

  const categoryCartQty = useCallback(
    (category: 'popcorn' | 'iced_tea') => {
      const list =
        category === 'popcorn'
          ? popcornByCategory.popcorn
          : popcornByCategory.icedTea;
      return list.reduce((sum, p) => sum + (popcornCart[p.id] || 0), 0);
    },
    [popcornByCategory, popcornCart]
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

  const addOneQuantityProduct = (product: ScanSaleProductItem) => {
    if (product.stock <= 0) return;
    const current = popcornCart[product.id] || 0;
    if (current >= product.stock) return;
    setPopcornQty(product.id, current + 1);
  };

  const clearAll = () => {
    setScanned([]);
    setPopcornCart({});
    setPickerCategory(null);
    setPickerFlavorKey(null);
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
    (isTicketAttach
      ? 'Ավելանում է պատվերին, վճարումը՝ դրամարկղում միասին'
      : 'Սկանավորեք ապրանքի QR-ը, քանակով ապրանքները՝ ձեռքով');

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
              {/* Քայլ 0՝ երկու բլոկ */}
              {pickerCategory == null && (
                <>
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                    Քանակով ապրանքներ
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {popcornByCategory.popcorn.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickerCategory('popcorn');
                          setPickerFlavorKey(null);
                        }}
                        className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-left transition hover:border-amber-400 hover:shadow-md"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                          <Popcorn className="h-7 w-7" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-bold text-gray-900">
                            Պոպկորն
                          </p>
                          <p className="text-sm text-gray-500">
                            {flavorGroupsFor('popcorn').length} համ · ընտրեք
                            չափը
                          </p>
                        </div>
                        {categoryCartQty('popcorn') > 0 && (
                          <span className="rounded-full bg-amber-500 px-2.5 py-1 text-sm font-bold text-white">
                            {categoryCartQty('popcorn')}
                          </span>
                        )}
                      </button>
                    )}
                    {popcornByCategory.icedTea.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickerCategory('iced_tea');
                          setPickerFlavorKey(null);
                        }}
                        className="flex items-center gap-4 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 p-5 text-left transition hover:border-sky-400 hover:shadow-md"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                          <CupSoda className="h-7 w-7" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-bold text-gray-900">
                            Սառը թեյ
                          </p>
                          <p className="text-sm text-gray-500">
                            {flavorGroupsFor('iced_tea').length} համ · ընտրեք
                            չափը
                          </p>
                        </div>
                        {categoryCartQty('iced_tea') > 0 && (
                          <span className="rounded-full bg-sky-500 px-2.5 py-1 text-sm font-bold text-white">
                            {categoryCartQty('iced_tea')}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Քայլ 1՝ համեր */}
              {pickerCategory != null && pickerFlavorKey == null && (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPickerCategory(null);
                        setPickerFlavorKey(null);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Ետ
                    </button>
                    <div>
                      <p className="text-base font-bold text-gray-900">
                        {pickerCategory === 'popcorn'
                          ? 'Պոպկորն — ընտրեք համը'
                          : 'Սառը թեյ — ընտրեք համը'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Հաջորդ քայլում կընտրեք Փոքր կամ Մեծ
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                    {activeFlavorGroups.map((group) => {
                      const inCart = flavorCartQty(group);
                      const anyStock =
                        (group.small?.stock ?? 0) > 0 ||
                        (group.large?.stock ?? 0) > 0;
                      return (
                        <button
                          key={group.flavorKey}
                          type="button"
                          disabled={!anyStock}
                          onClick={() => setPickerFlavorKey(group.flavorKey)}
                          className={`relative rounded-2xl border p-3.5 text-left transition ${
                            !anyStock
                              ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-50'
                              : inCart > 0
                                ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200'
                                : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/40'
                          }`}
                        >
                          {inCart > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-600 px-1.5 text-xs font-bold text-white">
                              {inCart}
                            </span>
                          )}
                          <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
                            {group.displayName}
                          </p>
                          {!anyStock && (
                            <p className="mt-1 text-xs font-medium text-red-500">
                              Առկա չէ
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Քայլ 2՝ չափ */}
              {pickerCategory != null &&
                pickerFlavorKey != null &&
                activeFlavorGroup && (
                  <>
                    <div className="mb-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPickerFlavorKey(null)}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Համեր
                      </button>
                      <div>
                        <p className="text-base font-bold text-gray-900">
                          {activeFlavorGroup.displayName}
                        </p>
                        <p className="text-xs text-gray-500">
                          Ընտրեք չափը — ավելացվում է 1 հատ
                        </p>
                      </div>
                    </div>
                    <div className="mx-auto grid max-w-lg grid-cols-2 gap-4">
                      {(
                        [
                          ['small', activeFlavorGroup.small],
                          ['large', activeFlavorGroup.large],
                        ] as const
                      ).map(([size, product]) => {
                        const sizeKey = size as QuantityProductSize;
                        const label = quantitySizeLabel(sizeKey);
                        if (!product) {
                          return (
                            <div
                              key={sizeKey}
                              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 opacity-50"
                            >
                              <p className="text-lg font-bold text-gray-400">
                                {label}
                              </p>
                              <p className="mt-1 text-xs text-gray-400">
                                Չկա տեսականու մեջ
                              </p>
                            </div>
                          );
                        }
                        const outOfStock = product.stock <= 0;
                        const inCart = popcornCart[product.id] || 0;
                        const reachedMax = inCart >= product.stock;
                        return (
                          <button
                            key={sizeKey}
                            type="button"
                            disabled={outOfStock || reachedMax}
                            onClick={() => {
                              addOneQuantityProduct(product);
                              setPickerFlavorKey(null);
                            }}
                            className={`flex flex-col items-center rounded-2xl border p-6 transition ${
                              outOfStock
                                ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
                                : 'border-purple-200 bg-white hover:border-purple-500 hover:bg-purple-50 hover:shadow-md active:scale-[0.98]'
                            }`}
                          >
                            <p className="text-2xl font-extrabold text-gray-900">
                              {label}
                            </p>
                            <p className="mt-2 text-lg font-bold text-purple-600">
                              {product.price.toLocaleString()} ֏
                            </p>
                            <p
                              className={`mt-1 text-xs ${
                                outOfStock ? 'text-red-500' : 'text-gray-400'
                              }`}
                            >
                              {outOfStock
                                ? 'Առկա չէ'
                                : `Մնացել է՝ ${product.stock}`}
                            </p>
                            {inCart > 0 && !outOfStock && (
                              <p className="mt-2 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                                Զամբյուղում՝ {inCart}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
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
                  const isTea = product.category === 'iced_tea';
                  return (
                    <div
                      key={`pc-${id}`}
                      className={`flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 ${
                        isTea ? 'bg-sky-50/50' : 'bg-amber-50/50'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isTea
                            ? 'bg-sky-100 text-sky-600'
                            : 'bg-amber-100 text-amber-600'
                        }`}
                      >
                        {isTea ? (
                          <CupSoda className="h-4 w-4" />
                        ) : (
                          <Popcorn className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {product.price.toLocaleString()} ֏ ×{' '}
                          <span className="font-semibold">{qty}</span> ={' '}
                          <span
                            className={`font-semibold ${
                              isTea ? 'text-sky-600' : 'text-amber-600'
                            }`}
                          >
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
                          className={`flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            isTea
                              ? 'hover:bg-sky-100 hover:text-sky-700'
                              : 'hover:bg-amber-100 hover:text-amber-700'
                          }`}
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
