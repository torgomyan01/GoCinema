'use client';

import { useMemo, useState } from 'react';
import {
  Loader2,
  Minus,
  Plus,
  Popcorn,
  Printer,
  Search,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';

interface ProductItem {
  id: number;
  name: string;
  price: number;
  category: string;
  image?: string | null;
  stock: number;
}

interface ProductSaleModalProps {
  products: ProductItem[];
  cart: Record<number, number>;
  setQty: (productId: number, qty: number) => void;
  total: number;
  count: number;
  isCreating: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const categoryLabels: Record<string, string> = {
  snack: 'Խորտիկներ',
  drink: 'Ըմպելիքներ',
  combo: 'Կոմբո',
};

export default function ProductSaleModal({
  products,
  cart,
  setQty,
  total,
  count,
  isCreating,
  onClose,
  onSubmit,
}: ProductSaleModalProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(p.category);
    return Array.from(set);
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory =
        activeCategory === 'all' || p.category === activeCategory;
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, search, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProductItem[]>();
    for (const product of filtered) {
      if (!map.has(product.category)) map.set(product.category, []);
      map.get(product.category)!.push(product);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Զամբյուղի տողերը
  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const product = products.find((p) => p.id === Number(id));
          return product ? { product, qty } : null;
        })
        .filter((x): x is { product: ProductItem; qty: number } => x !== null),
    [cart, products]
  );

  const clearCart = () => {
    for (const { product } of cartLines) setQty(product.id, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Վերնագիր */}
      <header className="flex items-center justify-between border-b border-amber-200 bg-amber-500 px-4 py-3 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/20 p-2">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight sm:text-xl">
              Ապրանքների վաճառք
            </h2>
            <p className="text-xs text-amber-50 sm:text-sm">
              Կանխիկ վաճառք՝ առանց տոմսի
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          disabled={isCreating}
          className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium transition hover:bg-white/25 disabled:opacity-40"
        >
          <X className="h-5 w-5" />
          <span className="hidden sm:inline">Փակել</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Ձախ՝ ապրանքներ */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Որոնում + բաժիններ */}
          <div className="space-y-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Որոնել ապրանք..."
                autoFocus
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            </div>

            {categories.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    activeCategory === 'all'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Բոլորը
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      activeCategory === category
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {categoryLabels[category] || category}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ապրանքների ցանց */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {products.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center text-gray-400">
                <Popcorn className="h-12 w-12" />
                <p className="text-sm">Ապրանքներ չկան</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center text-gray-400">
                <Search className="h-12 w-12" />
                <p className="text-sm">Որոնմանը համապատասխան ապրանք չի գտնվել</p>
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map(([category, items]) => (
                  <div key={category}>
                    <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                      {categoryLabels[category] || category}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                      {items.map((product) => {
                        const qty = cart[product.id] || 0;
                        const outOfStock = product.stock <= 0;
                        const reachedMax = qty >= product.stock;
                        return (
                          <div
                            key={product.id}
                            className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition ${
                              outOfStock
                                ? 'border-gray-200 opacity-60'
                                : qty > 0
                                  ? 'border-amber-400 ring-2 ring-amber-200'
                                  : 'border-gray-200 hover:border-amber-300 hover:shadow-md'
                            }`}
                          >
                            {qty > 0 && (
                              <span className="absolute right-2 top-2 z-10 flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-500 px-2 text-sm font-bold text-white shadow">
                                {qty}
                              </span>
                            )}
                            {outOfStock && (
                              <span className="absolute left-2 top-2 z-10 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow">
                                Առկա չէ
                              </span>
                            )}

                            {/* Նկար */}
                            <div className="aspect-square w-full overflow-hidden bg-gray-100">
                              {product.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="h-full w-full object-cover transition group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-gray-300">
                                  <Popcorn className="h-10 w-10" />
                                </div>
                              )}
                            </div>

                            {/* Տվյալներ */}
                            <div className="flex flex-1 flex-col p-3">
                              <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                                {product.name}
                              </p>
                              <p className="mt-0.5 text-sm font-bold text-amber-600">
                                {product.price.toLocaleString()} ֏
                              </p>
                              <p
                                className={`mt-0.5 text-xs ${
                                  outOfStock
                                    ? 'text-red-500'
                                    : product.stock <= 5
                                      ? 'text-amber-600'
                                      : 'text-gray-400'
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
                                    onClick={() => setQty(product.id, 1)}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Ավելացնել
                                  </button>
                                ) : (
                                  <div className="flex items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setQty(product.id, qty - 1)}
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
                                      onClick={() => setQty(product.id, qty + 1)}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-amber-100 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Աջ՝ զամբյուղ */}
        <aside className="flex max-h-[45vh] min-h-0 shrink-0 flex-col border-t border-gray-200 bg-white lg:max-h-none lg:w-[400px] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="flex items-center gap-2 font-bold text-gray-900">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
              Զամբյուղ
              {count > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {count}
                </span>
              )}
            </h3>
            {cartLines.length > 0 && (
              <button
                onClick={clearCart}
                disabled={isCreating}
                className="flex items-center gap-1 text-xs font-medium text-gray-400 transition hover:text-red-500 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Մաքրել
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {cartLines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center text-gray-400">
                <ShoppingCart className="h-12 w-12" />
                <p className="text-sm">
                  Ընտրեք ապրանքներ՝ վաճառքը սկսելու համար
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {cartLines.map(({ product, qty }) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-2.5"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <Popcorn className="h-5 w-5" />
                        </div>
                      )}
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
                        onClick={() => setQty(product.id, qty - 1)}
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
                        onClick={() => setQty(product.id, qty + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-amber-100 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Հաշվարկ + կոճակ */}
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-base font-semibold text-gray-700">
                Ընդհանուր
              </span>
              <span className="text-2xl font-extrabold text-amber-700">
                {total.toLocaleString()} ֏
              </span>
            </div>
            <button
              onClick={onSubmit}
              disabled={isCreating || count === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Printer className="h-5 w-5" />
              )}
              Վաճառել և տպել
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
