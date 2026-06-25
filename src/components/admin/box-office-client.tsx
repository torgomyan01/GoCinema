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
  ChevronLeft,
  ChevronRight,
  Printer,
  RotateCcw,
  ShoppingBag,
  Ticket as TicketIcon,
  User,
  X,
  Ban,
} from 'lucide-react';
import {
  cancelBoxOfficeTicket,
  createBoxOfficeProductOrder,
  createBoxOfficeTicket,
  getBoxOfficeProducts,
  getBoxOfficeScreenings,
  getBoxOfficeSeatMap,
  getBoxOfficeTicketBySeat,
} from '@/app/actions/box-office';
import ProductSaleModal from '@/components/admin/box-office-product-sale-modal';
import TicketSaleModal from '@/components/admin/box-office-ticket-sale-modal';

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
  seat: { id: number; row: string; number: number; seatType: string };
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
  stock: number;
}

const statusLabels: Record<string, string> = {
  reserved: 'Ամրագրված',
  paid: 'Վճարված',
  used: 'Օգտագործված',
  cancelled: 'Չեղարկված',
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

  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [isSeatLoading, setIsSeatLoading] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<SeatItem | null>(null);
  const [price, setPrice] = useState<number>(0);

  const [isCreating, setIsCreating] = useState(false);
  const [lastTicket, setLastTicket] = useState<CreatedTicket | null>(null);

  const [takenTicket, setTakenTicket] = useState<TakenTicketInfo | null>(null);
  const [isTakenLoading, setIsTakenLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [takenModalError, setTakenModalError] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductItem[]>([]);
  // productId -> quantity (տոմսի հետ վաճառվող ապրանքներ)
  const [cart, setCart] = useState<Record<number, number>>({});

  // Ինքնուրույն ապրանքների վաճառք (առանց տոմսի)
  const [productSaleOpen, setProductSaleOpen] = useState(false);
  const [productCart, setProductCart] = useState<Record<number, number>>({});
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    id: number;
    total: number;
  } | null>(null);

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

  const loadProducts = async () => {
    const result = await getBoxOfficeProducts();
    if (result.success) {
      setProducts(result.products as ProductItem[]);
    }
  };

  useEffect(() => {
    void loadScreenings();
    void loadProducts();
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

  const setStandaloneQty = (productId: number, qty: number) => {
    setProductCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[productId];
      } else {
        next[productId] = qty;
      }
      return next;
    });
  };

  const standaloneTotal = useMemo(
    () =>
      Object.entries(productCart).reduce((sum, [id, qty]) => {
        const product = products.find((p) => p.id === Number(id));
        return product ? sum + product.price * qty : sum;
      }, 0),
    [productCart, products]
  );

  const standaloneCount = useMemo(
    () => Object.values(productCart).reduce((sum, qty) => sum + qty, 0),
    [productCart]
  );

  const openProductSale = () => {
    setProductCart({});
    setError(null);
    setProductSaleOpen(true);
  };

  const closeProductSale = () => {
    if (isCreatingOrder) return;
    setProductSaleOpen(false);
    setProductCart({});
  };

  const openOrderPrint = (orderId: number) => {
    window.open(
      `/admin/box-office/print-order/${orderId}`,
      '_blank',
      'width=420,height=640'
    );
  };

  const handleCreateProductOrder = async () => {
    if (isCreatingOrder) return;
    const selections = Object.entries(productCart).map(([id, qty]) => ({
      productId: Number(id),
      quantity: qty,
    }));
    if (selections.length === 0) {
      setError('Ընտրեք առնվազն մեկ ապրանք');
      return;
    }
    setIsCreatingOrder(true);
    setError(null);
    try {
      const result = await createBoxOfficeProductOrder({
        products: selections,
      });
      if (!result.success || !result.order) {
        setError(result.error || 'Ապրանքների վաճառքը չստացվեց');
        return;
      }
      const order = result.order as { id: number };
      setLastOrder({ id: order.id, total: result.total ?? standaloneTotal });
      openOrderPrint(order.id);
      setProductSaleOpen(false);
      setProductCart({});
      void loadProducts();
    } catch (err) {
      console.error('Product order error:', err);
      setError('Ապրանքների վաճառքը չստացվեց');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const grandTotal = (Number.isFinite(price) ? price : 0) + productsTotal;

  const movies = useMemo(() => {
    const map = new Map<
      number,
      {
        id: number;
        title: string;
        image?: string | null;
        screeningCount: number;
      }
    >();
    for (const s of screenings) {
      const existing = map.get(s.movie.id);
      if (existing) {
        existing.screeningCount += 1;
      } else {
        map.set(s.movie.id, {
          id: s.movie.id,
          title: s.movie.title,
          image: s.movie.image,
          screeningCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.title.localeCompare(b.title, 'hy')
    );
  }, [screenings]);

  const selectedMovie = useMemo(() => {
    if (!selectedMovieId) return null;
    return movies.find((m) => m.id === selectedMovieId) ?? null;
  }, [movies, selectedMovieId]);

  const movieScreenings = useMemo(() => {
    if (!selectedMovieId) return [];
    return screenings
      .filter((s) => s.movie.id === selectedMovieId)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
  }, [screenings, selectedMovieId]);

  const movieDays = useMemo(() => {
    const map = new Map<string, Date | string>();
    for (const s of movieScreenings) {
      const key = dayKey(s.startTime);
      if (!map.has(key)) map.set(key, s.startTime);
    }
    return Array.from(map.entries()).map(([key, date]) => ({ key, date }));
  }, [movieScreenings]);

  useEffect(() => {
    if (!selectedMovieId) {
      setSelectedDay(null);
      return;
    }
    if (
      movieDays.length > 0 &&
      (!selectedDay || !movieDays.some((d) => d.key === selectedDay))
    ) {
      setSelectedDay(movieDays[0].key);
    }
  }, [selectedMovieId, movieDays, selectedDay]);

  const dayScreenings = useMemo(
    () => movieScreenings.filter((s) => dayKey(s.startTime) === selectedDay),
    [movieScreenings, selectedDay]
  );

  const selectMovie = (movieId: number) => {
    setSelectedMovieId(movieId);
    setSeatMap(null);
    setSelectedSeat(null);
    setSelectedDay(null);
    setError(null);
  };

  const backToMovies = () => {
    setSelectedMovieId(null);
    setSeatMap(null);
    setSelectedSeat(null);
    setSelectedDay(null);
    setError(null);
  };

  const backToScreenings = () => {
    setSeatMap(null);
    setSelectedSeat(null);
    setError(null);
  };

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
    setShowCancelConfirm(false);
    setTakenModalError(null);
    const result = await getBoxOfficeTicketBySeat(seatMap.id, seat.id);
    if (result.success && result.ticket) {
      setTakenTicket(result.ticket as unknown as TakenTicketInfo);
    } else {
      setError(result.error || 'Տոմսը չի գտնվել');
    }
    setIsTakenLoading(false);
  };

  const seatRows = useMemo((): [string, SeatItem[]][] => {
    if (!seatMap) return [];
    const map = new Map<string, SeatItem[]>();
    for (const seat of seatMap.seats) {
      if (!map.has(seat.row)) map.set(seat.row, []);
      map.get(seat.row)!.push(seat);
    }
    const rows = Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    for (const [, seats] of rows) {
      seats.sort((a, b) => b.number - a.number);
    }
    return rows;
  }, [seatMap]);

  const closeTakenModal = () => {
    setTakenTicket(null);
    setIsTakenLoading(false);
    setShowCancelConfirm(false);
    setTakenModalError(null);
  };

  const handleCancelTicket = async () => {
    if (!takenTicket || !seatMap || isCancelling) return;

    setIsCancelling(true);
    setTakenModalError(null);
    try {
      const result = await cancelBoxOfficeTicket(takenTicket.id);
      if (!result.success) {
        setTakenModalError(
          result.error || 'Տոմսը չեղարկելիս սխալ է տեղի ունեցել'
        );
        return;
      }

      setSeatMap((prev) =>
        prev
          ? {
              ...prev,
              seats: prev.seats.map((s) =>
                s.id === takenTicket.seat.id ? { ...s, taken: false } : s
              ),
            }
          : prev
      );
      closeTakenModal();
      void loadScreenings();
      void loadProducts();
    } catch (err) {
      console.error('Cancel ticket error:', err);
      setTakenModalError('Տոմսը չեղարկելիս սխալ է տեղի ունեցել');
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancelTakenTicket =
    takenTicket &&
    (takenTicket.status === 'paid' || takenTicket.status === 'reserved');

  const cannotCancelReason =
    takenTicket?.status === 'used'
      ? 'Տոմսն արդեն օգտագործված է (սկանավորված մուտք) և չի կարող չեղարկվել'
      : takenTicket?.status === 'cancelled'
        ? 'Տոմսն արդեն չեղարկված է'
        : null;

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
      void loadProducts();
    } catch (err) {
      console.error('Box office create error:', err);
      setError('Տոմս ստեղծելիս սխալ է տեղի ունեցել');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-100 p-2">
            <Banknote className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Դրամարկղ</h1>
            <p className="text-sm text-gray-600">
              Տոմսերի և ապրանքների վաճառք՝ կանխիկ վճարումով
            </p>
          </div>
        </div>
        <button
          onClick={openProductSale}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-400"
        >
          <ShoppingBag className="h-4 w-4" />
          Ապրանքների վաճառք
        </button>
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

      {lastOrder && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-amber-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Ապրանքների վաճառք #{lastOrder.id} —{' '}
              {lastOrder.total.toLocaleString()} ֏
            </span>
          </div>
          <button
            onClick={() => openOrderPrint(lastOrder.id)}
            className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
          >
            <Printer className="h-4 w-4" />
            Տպել կրկին
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Ձախ՝ ֆիլմ → ցուցադրություն → նստատեղ */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <CalendarDays className="h-5 w-5 text-gray-500" />
              Վաճառք
            </h2>
            <button
              onClick={loadScreenings}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Թարմացնել"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Քայլերի ցուցիչ */}
          <div className="mb-4 flex items-center gap-1.5 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                !selectedMovieId
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 text-green-700'
              }`}
            >
              1. Ֆիլմ
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                selectedMovieId && !seatMap
                  ? 'bg-green-600 text-white'
                  : selectedMovieId
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              2. Ցուցադրություն
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                seatMap
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              3. Նստատեղ
            </span>
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
          ) : !selectedMovieId ? (
            /* Քայլ 1 — ֆիլմի ընտրություն */
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              <p className="mb-2 text-xs text-gray-500">Ընտրեք ֆիլմը</p>
              {movies.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => selectMovie(movie.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-green-300 hover:bg-green-50/50"
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {movie.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={movie.image}
                        alt={movie.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Film className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">
                      {movie.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {movie.screeningCount} ցուցադրություն
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </button>
              ))}
            </div>
          ) : !seatMap ? (
            /* Քայլ 2 — ցուցադրության ընտրություն */
            <>
              <button
                onClick={backToMovies}
                className="mb-3 flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-green-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Վերադառնալ ֆիլմերին
              </button>

              {selectedMovie && (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
                  <div className="h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-white">
                    {selectedMovie.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedMovie.image}
                        alt={selectedMovie.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Film className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <p className="truncate font-semibold text-green-900">
                    {selectedMovie.title}
                  </p>
                </div>
              )}

              {movieDays.length > 1 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {movieDays.map(({ key, date }) => (
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
              )}

              <p className="mb-2 text-xs text-gray-500">Ընտրեք ցուցադրությունը</p>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {dayScreenings.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openSeatMap(s.id)}
                    className="w-full rounded-xl border border-gray-200 p-3 text-left transition hover:border-green-300 hover:bg-green-50/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                        <Clock className="h-4 w-4 text-green-600" />
                        {formatTime(s.startTime)}
                      </span>
                      <span className="text-xs font-medium text-gray-500">
                        {s.hall.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                      <span>{formatDay(s.startTime)}</span>
                      <span>
                        {s.soldCount}/{s.capacity} վաճառված ·{' '}
                        {s.basePrice.toLocaleString()} ֏
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Քայլ 3 — ընտրված ցուցադրության ամփոփում */
            <>
              <button
                onClick={backToScreenings}
                className="mb-3 flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-green-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Փոխել ցուցադրությունը
              </button>

              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="font-bold text-green-900">{seatMap.movie.title}</p>
                <p className="mt-1 text-sm text-green-800">
                  {formatDay(seatMap.startTime)} · {formatTime(seatMap.startTime)}
                </p>
                <p className="mt-0.5 text-sm text-green-700">{seatMap.hall.name}</p>
                <p className="mt-2 text-xs text-green-600">
                  Ընտրեք նստատեղը աջ կողմից
                </p>
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
              <p className="text-center text-sm">
                {!selectedMovieId
                  ? 'Նախ ընտրեք ֆիլմը ձախ կողմից'
                  : 'Ընտրեք ցուցադրությունը՝ նստատեղ ընտրելու համար'}
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
        <TicketSaleModal
          movieTitle={seatMap.movie.title}
          startTime={seatMap.startTime}
          seat={selectedSeat}
          price={price}
          setPrice={setPrice}
          products={products}
          cart={cart}
          setQty={setProductQty}
          productsTotal={productsTotal}
          grandTotal={grandTotal}
          isCreating={isCreating}
          onClose={closeSale}
          onSubmit={handleCreate}
        />
      )}

      {/* Ինքնուրույն ապրանքների վաճառքի մոդալ */}
      {productSaleOpen && (
        <ProductSaleModal
          products={products}
          cart={productCart}
          setQty={setStandaloneQty}
          total={standaloneTotal}
          count={standaloneCount}
          isCreating={isCreatingOrder}
          onClose={closeProductSale}
          onSubmit={handleCreateProductOrder}
        />
      )}

      {/* Զբաղված տեղի տոմսի ինֆո */}
      {(takenTicket || isTakenLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={closeTakenModal}
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
                onClick={closeTakenModal}
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
                {takenModalError && (
                  <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {takenModalError}
                  </div>
                )}

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
                            : takenTicket.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
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

                {showCancelConfirm && canCancelTakenTicket && (
                  <div className="border-t border-red-100 bg-red-50 px-5 py-4">
                    <p className="text-sm text-red-800">
                      Չեղարկե՞լ տոմս #{takenTicket.id} ({takenTicket.seat.row}
                      {takenTicket.seat.number})։ Նստատեղը կրկին ազատ կլինի
                      վաճառքի համար։
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          setShowCancelConfirm(false);
                          setTakenModalError(null);
                        }}
                        disabled={isCancelling}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Ոչ
                      </button>
                      <button
                        onClick={handleCancelTicket}
                        disabled={isCancelling}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {isCancelling ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                        Այո, չեղարկել
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
                  {canCancelTakenTicket && !showCancelConfirm && (
                    <button
                      onClick={() => {
                        setTakenModalError(null);
                        setShowCancelConfirm(true);
                      }}
                      disabled={isCancelling}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <Ban className="h-4 w-4" />
                      Չեղարկել տոմսը (ազատել նստատեղը)
                    </button>
                  )}

                  {cannotCancelReason && (
                    <p className="text-center text-xs text-gray-500">
                      {cannotCancelReason}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => openPrint(takenTicket.id)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500"
                    >
                      <Printer className="h-4 w-4" />
                      Տպել կրկին
                    </button>
                    <button
                      onClick={closeTakenModal}
                      disabled={isCancelling}
                      className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      Փակել
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
