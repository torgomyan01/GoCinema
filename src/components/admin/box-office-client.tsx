'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Film,
  Loader2,
  Minus,
  Plus,
  Popcorn,
  Printer,
  RotateCcw,
  Ticket as TicketIcon,
  User,
  X,
} from 'lucide-react';
import {
  createBoxOfficeTicket,
  getBoxOfficeProducts,
  getBoxOfficeScreenings,
  getBoxOfficeSeatMap,
  getBoxOfficeTicketBySeat,
} from '@/app/actions/box-office';

interface ScreeningListItem {
  id: number;
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
  movie: { id: number; title: string; image?: string | null; duration: number };
  hall: { id: number; name: string; capacity: number };
  soldCount: number;
  capacity: number;
}

interface SeatItem {
  id: number;
  row: string;
  number: number;
  seatType: string;
  taken: boolean;
}

interface SeatMap {
  id: number;
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
  movie: { id: number; title: string; duration: number };
  hall: { id: number; name: string; capacity: number };
  seats: SeatItem[];
}

interface CreatedTicket {
  id: number;
  price: number;
  seat: { row: string; number: number };
  screening: {
    startTime: Date | string;
    movie: { title: string };
    hall: { name: string };
  };
}

interface TakenTicketInfo {
  id: number;
  price: number;
  status: string;
  qrCode?: string | null;
  createdAt: Date | string;
  seat: { row: string; number: number; seatType: string };
  user?: { name?: string | null; phone?: string | null } | null;
  payment?: { method: string; status: string; amount: number } | null;
  screening: {
    startTime: Date | string;
    movie: { title: string };
    hall: { name: string };
  };
}

interface ProductItem {
  id: number;
  name: string;
  price: number;
  category: string;
  image?: string | null;
}

const statusLabels: Record<string, string> = {
  reserved: 'Ամրագրված',
  paid: 'Վճարված',
  used: 'Օգտագործված',
  cancelled: 'Չեղարկված',
};

const categoryLabels: Record<string, string> = {
  snack: 'Խորտիկներ',
  drink: 'Ըմպելիքներ',
  combo: 'Կոմբո',
};

function formatDay(value: Date | string) {
  return new Date(value).toLocaleDateString('hy-AM', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function formatTime(value: Date | string) {
  return new Date(value).toLocaleTimeString('hy-AM', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayKey(value: Date | string) {
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function BoxOfficeClient() {
  const [screenings, setScreenings] = useState<ScreeningListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [isSeatLoading, setIsSeatLoading] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<SeatItem | null>(null);
  const [price, setPrice] = useState<number>(0);

  const [isCreating, setIsCreating] = useState(false);
  const [lastTicket, setLastTicket] = useState<CreatedTicket | null>(null);

  const [takenTicket, setTakenTicket] = useState<TakenTicketInfo | null>(null);
  const [isTakenLoading, setIsTakenLoading] = useState(false);

  const [products, setProducts] = useState<ProductItem[]>([]);
  // productId -> quantity
  const [cart, setCart] = useState<Record<number, number>>({});

  const loadScreenings = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getBoxOfficeScreenings();
    if (result.success) {
      setScreenings(result.screenings as ScreeningListItem[]);
    } else {
      setError(
        result.error || 'Ցուցադրությունները բեռնելիս սխալ է տեղի ունեցել'
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadScreenings();
    void (async () => {
      const result = await getBoxOfficeProducts();
      if (result.success) {
        setProducts(result.products as ProductItem[]);
      }
    })();
  }, []);

  const setProductQty = (productId: number, qty: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[productId];
      } else {
        next[productId] = qty;
      }
      return next;
    });
  };

  const productsTotal = useMemo(
    () =>
      Object.entries(cart).reduce((sum, [id, qty]) => {
        const product = products.find((p) => p.id === Number(id));
        return product ? sum + product.price * qty : sum;
      }, 0),
    [cart, products]
  );

  const grandTotal = (Number.isFinite(price) ? price : 0) + productsTotal;

  const groupedProducts = useMemo(() => {
    const map = new Map<string, ProductItem[]>();
    for (const product of products) {
      if (!map.has(product.category)) map.set(product.category, []);
      map.get(product.category)!.push(product);
    }
    return Array.from(map.entries());
  }, [products]);

  const days = useMemo(() => {
    const map = new Map<string, Date | string>();
    for (const s of screenings) {
      const key = dayKey(s.startTime);
      if (!map.has(key)) map.set(key, s.startTime);
    }
    return Array.from(map.entries()).map(([key, date]) => ({ key, date }));
  }, [screenings]);

  useEffect(() => {
    if (!selectedDay && days.length > 0) {
      setSelectedDay(days[0].key);
    }
  }, [days, selectedDay]);

  const dayScreenings = useMemo(
    () => screenings.filter((s) => dayKey(s.startTime) === selectedDay),
    [screenings, selectedDay]
  );

  const openSeatMap = async (screeningId: number) => {
    setIsSeatLoading(true);
    setSelectedSeat(null);
    setCart({});
    setError(null);
    const result = await getBoxOfficeSeatMap(screeningId);
    if (result.success && result.data) {
      const data = result.data as SeatMap;
      setSeatMap(data);
      setPrice(data.basePrice);
    } else {
      setError(result.error || 'Նստատեղերը բեռնելիս սխալ է տեղի ունեցել');
    }
    setIsSeatLoading(false);
  };

  const selectSeat = (seat: SeatItem) => {
    if (seat.taken) {
      void openTakenSeat(seat);
      return;
    }
    setSelectedSeat(seat);
    if (seatMap) {
      setPrice(
        seat.seatType === 'vip'
          ? Math.round(seatMap.basePrice * 1.5)
          : seatMap.basePrice
      );
    }
  };

  const openTakenSeat = async (seat: SeatItem) => {
    if (!seatMap) return;
    setIsTakenLoading(true);
    setTakenTicket(null);
    const result = await getBoxOfficeTicketBySeat(seatMap.id, seat.id);
    if (result.success && result.ticket) {
      setTakenTicket(result.ticket as unknown as TakenTicketInfo);
    } else {
      setError(result.error || 'Տոմսը չի գտնվել');
    }
    setIsTakenLoading(false);
  };

  const seatRows = useMemo(() => {
    if (!seatMap) return [];
    const map = new Map<string, SeatItem[]>();
    for (const seat of seatMap.seats) {
      if (!map.has(seat.row)) map.set(seat.row, []);
      map.get(seat.row)!.push(seat);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [seatMap]);

  const openPrint = (ticketId: number) => {
    window.open(
      `/admin/box-office/print/${ticketId}`,
      '_blank',
      'width=420,height=640'
    );
  };

  const closeSale = () => {
    if (isCreating) return;
    setSelectedSeat(null);
    setCart({});
  };

  const handleCreate = async () => {
    if (!seatMap || !selectedSeat || isCreating) return;
    if (!Number.isFinite(price) || price < 0) {
      setError('Մուտքագրեք վավեր գին');
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const result = await createBoxOfficeTicket({
        screeningId: seatMap.id,
        seatId: selectedSeat.id,
        price,
        products: Object.entries(cart).map(([id, qty]) => ({
          productId: Number(id),
          quantity: qty,
        })),
      });
      if (!result.success || !result.ticket) {
        setError(result.error || 'Տոմս ստեղծելիս սխալ է տեղի ունեցել');
        return;
      }
      const ticket = result.ticket as unknown as CreatedTicket;
      setLastTicket(ticket);
      openPrint(ticket.id);

      // Թարմացնել նստատեղերի քարտեզը՝ նոր զբաղված տեղով
      setSeatMap((prev) =>
        prev
          ? {
              ...prev,
              seats: prev.seats.map((s) =>
                s.id === selectedSeat.id ? { ...s, taken: true } : s
              ),
            }
          : prev
      );
      setSelectedSeat(null);
      setCart({});
      void loadScreenings();
    } catch (err) {
      console.error('Box office create error:', err);
      setError('Տոմս ստեղծելիս սխալ է տեղի ունեցել');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-green-100 p-2">
          <Banknote className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Դրամարկղ</h1>
          <p className="text-sm text-gray-600">
            Տոմսի վաճառք դրամարկղից՝ կանխիկ վճարումով
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {lastTicket && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-green-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Տոմս #{lastTicket.id} ստեղծվեց՝ {lastTicket.screening.movie.title}
              , տեղ {lastTicket.seat.row}
              {lastTicket.seat.number}, {lastTicket.price.toLocaleString()} ֏
            </span>
          </div>
          <button
            onClick={() => openPrint(lastTicket.id)}
            className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
          >
            <Printer className="h-4 w-4" />
            Տպել կրկին
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Ձախ՝ ցուցադրությունների ընտրություն */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <CalendarDays className="h-5 w-5 text-gray-500" />
              Ցուցադրություններ
            </h2>
            <button
              onClick={loadScreenings}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Թարմացնել"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
              Բեռնվում է...
            </div>
          ) : screenings.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Առաջիկա ցուցադրություններ չկան
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {days.map(({ key, date }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      selectedDay === key
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {formatDay(date)}
                  </button>
                ))}
              </div>

              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {dayScreenings.map((s) => {
                  const isActive = seatMap?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => openSeatMap(s.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isActive
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-semibold text-gray-900">
                          <Film className="h-4 w-4 text-gray-400" />
                          {s.movie.title}
                        </span>
                        <span className="flex items-center gap-1 text-sm font-bold text-green-700">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(s.startTime)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                        <span>{s.hall.name}</span>
                        <span>
                          {s.soldCount}/{s.capacity} վաճառված ·{' '}
                          {s.basePrice.toLocaleString()} ֏
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Աջ՝ նստատեղեր և վաճառք */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          {isSeatLoading ? (
            <div className="flex h-72 items-center justify-center text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !seatMap ? (
            <div className="flex h-72 flex-col items-center justify-center gap-3 text-gray-400">
              <Film className="h-12 w-12" />
              <p className="text-sm">
                Ընտրեք ցուցադրություն՝ նստատեղ ընտրելու համար
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 border-b border-gray-100 pb-3">
                <p className="font-bold text-gray-900">{seatMap.movie.title}</p>
                <p className="text-sm text-gray-500">
                  {formatDay(seatMap.startTime)} ·{' '}
                  {formatTime(seatMap.startTime)} · {seatMap.hall.name}
                </p>
              </div>

              {/* Էկրան և նստատեղեր՝ նույն լայնությամբ */}
              <div className="mx-auto mb-4 w-full max-w-md">
                {/* Էկրան */}
                <div className="mb-6 perspective-near">
                  <div className="h-3 w-full rounded-t-[50%] bg-linear-to-b from-gray-400 to-gray-200 shadow-[0_10px_24px_-8px_rgba(22,163,74,0.55)] transform-[rotateX(-32deg)]" />
                  <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-[0.35em] text-gray-400">
                    Էկրան
                  </p>
                </div>

                {/* Նստատեղեր */}
                <div className="space-y-2">
                  {seatRows.map(([row, seats]) => (
                    <div key={row} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">
                        {row}
                      </span>
                      <div className="flex flex-1 flex-wrap justify-center gap-1.5">
                        {seats.map((seat) => {
                          const isSelected = selectedSeat?.id === seat.id;
                          const isVip = seat.seatType === 'vip';
                          return (
                            <button
                              key={seat.id}
                              onClick={() => selectSeat(seat)}
                              title={`${seat.row}${seat.number}${isVip ? ' (VIP)' : ''}${seat.taken ? ' — զբաղված (սեղմեք՝ տոմսը տեսնելու)' : ''}`}
                              className={`flex h-10 w-10 items-center justify-center rounded-lg text-[11px] font-semibold transition ${
                                seat.taken
                                  ? 'bg-gray-300 text-gray-500 line-through hover:bg-gray-400 hover:text-white'
                                  : isSelected
                                    ? 'scale-110 bg-green-600 text-white shadow-md shadow-green-300 ring-2 ring-green-300'
                                    : isVip
                                      ? 'bg-amber-100 text-amber-700 shadow-sm hover:bg-amber-200'
                                      : 'bg-gray-100 text-gray-700 shadow-sm hover:bg-green-100 hover:text-green-700'
                              }`}
                            >
                              {seat.number}
                            </button>
                          );
                        })}
                      </div>
                      <span className="w-5 shrink-0" aria-hidden />
                    </div>
                  ))}
                </div>
              </div>

              {/* Լեգենդ */}
              <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-gray-100" /> Ազատ
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-amber-100" /> VIP
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-green-600" /> Ընտրված
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-gray-200" /> Զբաղված
                </span>
              </div>

              <p className="text-center text-xs text-gray-400">
                Ընտրեք ազատ նստատեղ՝ վաճառքը սկսելու համար
              </p>
            </>
          )}
        </div>
      </div>

      {/* Վաճառքի մոդալ՝ ապրանքների ընտրությամբ */}
      {seatMap && selectedSeat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={closeSale}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Վերնագիր */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-gray-900">
                  <TicketIcon className="h-5 w-5 text-green-600" />
                  Նոր վաճառք
                </h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {seatMap.movie.title} · {formatTime(seatMap.startTime)} · Տեղ{' '}
                  {selectedSeat.row}
                  {selectedSeat.number}
                  {selectedSeat.seatType === 'vip' ? ' (VIP)' : ''}
                </p>
              </div>
              <button
                onClick={closeSale}
                disabled={isCreating}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Բովանդակություն */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Տոմսի գին */}
              <label className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                Տոմսի գին՝
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
                <span className="font-semibold text-gray-900">֏</span>
              </label>

              {/* Ապրանքներ */}
              {products.length > 0 ? (
                <div className="rounded-xl border border-gray-100 p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Popcorn className="h-4 w-4 text-amber-500" />
                    Ապրանքներ տոմսի հետ
                  </h4>
                  <div className="space-y-4">
                    {groupedProducts.map(([category, items]) => (
                      <div key={category}>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                          {categoryLabels[category] || category}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {items.map((product) => {
                            const qty = cart[product.id] || 0;
                            return (
                              <div
                                key={product.id}
                                className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 transition ${
                                  qty > 0
                                    ? 'border-green-400 bg-green-50'
                                    : 'border-gray-200'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-gray-900">
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {product.price.toLocaleString()} ֏
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setProductQty(product.id, qty - 1)
                                    }
                                    disabled={qty <= 0}
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-6 text-center text-sm font-bold text-gray-900">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setProductQty(product.id, qty + 1)
                                    }
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition hover:bg-green-100 hover:text-green-700"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-gray-100 p-4 text-sm text-gray-400">
                  Ապրանքներ չկան
                </p>
              )}
            </div>

            {/* Հաշվարկ + կոճակ */}
            <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
              <div className="mb-3 space-y-1 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Տոմս</span>
                  <span>
                    {(Number.isFinite(price) ? price : 0).toLocaleString()} ֏
                  </span>
                </div>
                {productsTotal > 0 && (
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Ապրանքներ</span>
                    <span>{productsTotal.toLocaleString()} ֏</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                  <span>Ընդհանուր</span>
                  <span className="text-green-700">
                    {grandTotal.toLocaleString()} ֏
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={closeSale}
                  disabled={isCreating}
                  className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Չեղարկել
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Printer className="h-5 w-5" />
                  )}
                  Ստեղծել և տպել
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Զբաղված տեղի տոմսի ինֆո */}
      {(takenTicket || isTakenLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => {
            setTakenTicket(null);
            setIsTakenLoading(false);
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
              <h3 className="flex items-center gap-2 font-bold text-gray-900">
                <TicketIcon className="h-5 w-5 text-green-600" />
                Տոմսի տվյալներ
              </h3>
              <button
                onClick={() => {
                  setTakenTicket(null);
                  setIsTakenLoading(false);
                }}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isTakenLoading || !takenTicket ? (
              <div className="flex h-48 items-center justify-center text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Տոմս</span>
                    <span className="font-bold text-gray-900">
                      #{takenTicket.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Կարգավիճակ</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        takenTicket.status === 'used'
                          ? 'bg-gray-100 text-gray-700'
                          : takenTicket.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {statusLabels[takenTicket.status] || takenTicket.status}
                    </span>
                  </div>
                  <div className="border-t border-gray-100" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Ֆիլմ</span>
                    <span className="font-semibold text-gray-900">
                      {takenTicket.screening.movie.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Ժամ</span>
                    <span className="text-gray-900">
                      {formatDay(takenTicket.screening.startTime)} ·{' '}
                      {formatTime(takenTicket.screening.startTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Տեղ</span>
                    <span className="font-semibold text-gray-900">
                      {takenTicket.seat.row}
                      {takenTicket.seat.number}
                      {takenTicket.seat.seatType === 'vip' ? ' (VIP)' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Գին</span>
                    <span className="font-bold text-gray-900">
                      {takenTicket.price.toLocaleString()} ֏
                    </span>
                  </div>
                  {takenTicket.payment && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Վճարում</span>
                      <span className="text-gray-900">
                        {takenTicket.payment.method === 'cash'
                          ? 'Կանխիկ'
                          : takenTicket.payment.method}
                      </span>
                    </div>
                  )}
                  {takenTicket.user?.name && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Հաճախորդ</span>
                      <span className="flex items-center gap-1.5 text-gray-900">
                        <User className="h-4 w-4 text-gray-400" />
                        {takenTicket.user.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4">
                  <button
                    onClick={() => openPrint(takenTicket.id)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500"
                  >
                    <Printer className="h-4 w-4" />
                    Տպել կրկին
                  </button>
                  <button
                    onClick={() => {
                      setTakenTicket(null);
                      setIsTakenLoading(false);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Փակել
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
