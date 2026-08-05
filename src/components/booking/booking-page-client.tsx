'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  Users,
  X,
  ShoppingCart,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  ArrowLeft,
  Popcorn,
  CupSoda,
  Gift,
} from 'lucide-react';
import {
  isQuantityOnlyProduct,
  parseQuantityProductName,
  quantityFlavorDisplayName,
  quantitySizeLabel,
  type QuantityProductSize,
} from '@/lib/product-units';

/** Մեկ տեղի բազկաթոռ */
function SeatIcon({
  className,
  filled = true,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 28 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="12" width="24" height="8" rx="1.5" />
      <path d="M5 12V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
    </svg>
  );
}

/** 2 տեղանոց բազկաթոռի պատկերակ (legend / զույգ միավոր) */
function LoveseatIcon({
  className,
  filled = true,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 52 26"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.15}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* shared back */}
      <path d="M5 13V7a3 3 0 0 1 3-3h36a3 3 0 0 1 3 3v6" />
      {/* left arm */}
      <path d="M3 13h4v10H4.5A1.5 1.5 0 0 1 3 21.5V13Z" />
      {/* left cushion */}
      <rect x="8" y="13" width="15" height="10" rx="1.5" />
      {/* center armrest */}
      <rect x="24" y="11" width="4" height="12" rx="1" />
      {/* right cushion */}
      <rect x="29" y="13" width="15" height="10" rx="1.5" />
      {/* right arm */}
      <path d="M49 13h-4v10h2.5A1.5 1.5 0 0 0 49 21.5V13Z" />
    </svg>
  );
}
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SITE_URL } from '@/utils/consts';
import { formatDateHy, formatTimeHy } from '@/lib/format';
import { getScreeningById } from '@/app/actions/screenings';
import { createOrder } from '@/app/actions/orders';
import { createCounterReservation } from '@/app/actions/reservations';
import { getProducts } from '@/app/actions/products';

interface BookingPageClientProps {
  screeningId: string;
}

interface Seat {
  id: number;
  row: string;
  number: number;
  seatType: string;
}

/** Տողի աթոռները զույգերով (1-2, 3-4, …) — ցուցադրումը մեծ → փոքր */
function pairSeatsForDisplay(seats: Seat[]): Seat[][] {
  const ascending = [...seats].sort((a, b) => a.number - b.number);
  const pairs: Seat[][] = [];
  for (let i = 0; i < ascending.length; i += 2) {
    pairs.push(ascending.slice(i, i + 2));
  }
  return pairs.reverse();
}

function seatToneClass(opts: {
  isMyPending: boolean;
  isOccupied: boolean;
  isSelected: boolean;
}) {
  if (opts.isMyPending) return 'text-amber-500';
  if (opts.isOccupied) return 'text-red-300 opacity-70';
  if (opts.isSelected) return 'text-purple-600';
  return 'text-gray-300 hover:text-gray-500';
}

interface Screening {
  id: number;
  movie: {
    id: number;
    title: string;
    slug?: string | null;
    image?: string | null;
    duration: number;
  };
  hall: {
    id: number;
    name: string;
    capacity: number;
    seats: Seat[];
  };
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
  tickets: Array<{
    id: number;
    userId?: number;
    status: string;
    holdUntil?: Date | string | null;
    seat: {
      id: number;
      row: string;
      number: number;
    };
  }>;
}

export default function BookingPageClient({
  screeningId,
}: BookingPageClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [seatProducts, setSeatProducts] = useState<
    Map<number, Map<number, number>>
  >(new Map()); // seatId -> Map<productId, quantity>
  const [screening, setScreening] = useState<Screening | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [currentSeatId, setCurrentSeatId] = useState<number | null>(null);
  const [currentSeatProducts, setCurrentSeatProducts] = useState<
    Map<number, number>
  >(new Map());
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  /** null = կատեգորիաներ, category = համեր, flavor = չափ */
  const [pickerCategory, setPickerCategory] = useState<
    'popcorn' | 'iced_tea' | null
  >(null);
  const [pickerFlavorKey, setPickerFlavorKey] = useState<string | null>(null);
  const [reserveWarningOpen, setReserveWarningOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [screeningResult, productsResult] = await Promise.all([
          getScreeningById(parseInt(screeningId, 10)),
          getProducts(),
        ]);

        if (screeningResult.success && screeningResult.screening) {
          setScreening(screeningResult.screening as Screening);
        } else {
          setError(screeningResult.error || 'Ցուցադրությունը չի գտնվել');
        }

        if (productsResult.success && productsResult.products) {
          setProducts(productsResult.products);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Տվյալները բեռնելիս սխալ է տեղի ունեցել');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [screeningId]);

  // Get occupied seat IDs from tickets (այլ օգտատերերի + սեփական hold)
  const currentUserId = useMemo(() => {
    if (!session?.user) return null;
    const raw = (session.user as { id?: string | number }).id;
    const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [session]);

  const occupiedSeatIds = useMemo(() => {
    if (!screening) return new Set<number>();
    return new Set(screening.tickets.map((ticket) => ticket.seat.id));
  }, [screening]);

  const myPendingSeatIds = useMemo(() => {
    if (!screening || currentUserId == null) return new Set<number>();
    return new Set(
      screening.tickets
        .filter(
          (t) => t.status === 'awaiting_payment' && t.userId === currentUserId
        )
        .map((t) => t.seat.id)
    );
  }, [screening, currentUserId]);

  const myPendingHoldUntil = useMemo(() => {
    if (!screening || currentUserId == null) return null;
    const mine = screening.tickets.find(
      (t) => t.status === 'awaiting_payment' && t.userId === currentUserId
    );
    return mine?.holdUntil ?? null;
  }, [screening, currentUserId]);

  // Check if user is logged in
  useEffect(() => {
    if (!session?.user && !isLoading) {
      router.push('/account');
    }
  }, [session, router, isLoading]);

  const formatTime = (date: Date | string) => formatTimeHy(date);

  const formatDate = (date: Date | string) =>
    formatDateHy(date, { weekday: true, year: true });

  const handleSeatClick = (seatId: number, isOccupied: boolean) => {
    if (isOccupied) return;

    // If seat is already selected, remove it
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats((prev) => prev.filter((id) => id !== seatId));
      setSeatProducts((prev) => {
        const newMap = new Map(prev);
        newMap.delete(seatId);
        return newMap;
      });
    } else {
      // Open product selection modal for this seat
      setCurrentSeatId(seatId);
      setCurrentSeatProducts(seatProducts.get(seatId) || new Map());
      setPickerCategory(null);
      setPickerFlavorKey(null);
      setProductModalOpen(true);
    }
  };

  const handleConfirmSeatProducts = () => {
    if (currentSeatId === null) return;

    // Add seat to selected seats
    setSelectedSeats((prev) => {
      if (!prev.includes(currentSeatId)) {
        return [...prev, currentSeatId];
      }
      return prev;
    });

    // Save products for this seat
    setSeatProducts((prev) => {
      const newMap = new Map(prev);
      newMap.set(currentSeatId, new Map(currentSeatProducts));
      return newMap;
    });

    // Close modal
    setProductModalOpen(false);
    setCurrentSeatId(null);
    setCurrentSeatProducts(new Map());
    setPickerCategory(null);
    setPickerFlavorKey(null);
  };

  const handleCancelSeatProducts = () => {
    setProductModalOpen(false);
    setCurrentSeatId(null);
    setCurrentSeatProducts(new Map());
    setPickerCategory(null);
    setPickerFlavorKey(null);
  };

  const handleProductQuantityChange = (productId: number, delta: number) => {
    setCurrentSeatProducts((prev) => {
      const newMap = new Map(prev);
      const currentQty = newMap.get(productId) || 0;
      const newQty = Math.max(0, currentQty + delta);
      if (newQty === 0) {
        newMap.delete(productId);
      } else {
        newMap.set(productId, newQty);
      }
      return newMap;
    });
  };

  type BookingProduct = {
    id: number;
    name: string;
    price: number;
    category: string;
    image?: string | null;
    description?: string | null;
    stock?: number;
  };

  type FlavorGroup = {
    flavorKey: string;
    displayName: string;
    small: BookingProduct | null;
    large: BookingProduct | null;
  };

  const quantityProducts = useMemo(
    () =>
      (products as BookingProduct[]).filter((p) =>
        isQuantityOnlyProduct(p.category)
      ),
    [products]
  );

  const popcornByCategory = useMemo(() => {
    const popcorn = quantityProducts.filter((p) => p.category === 'popcorn');
    const icedTea = quantityProducts.filter((p) => p.category === 'iced_tea');
    return { popcorn, icedTea };
  }, [quantityProducts]);

  const otherProducts = useMemo(
    () =>
      (products as BookingProduct[])
        .filter((p) => !isQuantityOnlyProduct(p.category))
        .sort((a, b) => a.name.localeCompare(b.name, 'hy')),
    [products]
  );

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
        else group.large = group.large ?? product;
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
      if (group.small) sum += currentSeatProducts.get(group.small.id) || 0;
      if (group.large) sum += currentSeatProducts.get(group.large.id) || 0;
      return sum;
    },
    [currentSeatProducts]
  );

  const categoryCartQty = useCallback(
    (category: 'popcorn' | 'iced_tea') => {
      const list =
        category === 'popcorn'
          ? popcornByCategory.popcorn
          : popcornByCategory.icedTea;
      return list.reduce(
        (sum, p) => sum + (currentSeatProducts.get(p.id) || 0),
        0
      );
    },
    [popcornByCategory, currentSeatProducts]
  );

  const categoryCoverImage = useCallback(
    (category: 'popcorn' | 'iced_tea') => {
      const list =
        category === 'popcorn'
          ? popcornByCategory.popcorn
          : popcornByCategory.icedTea;
      return list.find((p) => p.image)?.image ?? null;
    },
    [popcornByCategory]
  );

  const flavorCoverImage = (group: FlavorGroup) =>
    group.large?.image || group.small?.image || null;

  const getSeatInfo = (seatId: number) => {
    if (!screening) return null;
    const seat = screening.hall.seats.find((s) => s.id === seatId);
    return seat;
  };

  const productsTotal = useMemo(() => {
    let total = 0;
    seatProducts.forEach((productMap) => {
      productMap.forEach((qty, productId) => {
        const product = products.find((p) => p.id === productId);
        if (product) total += product.price * qty;
      });
    });
    return total;
  }, [seatProducts, products]);

  const totalPrice = useMemo(() => {
    if (!screening) return 0;
    return selectedSeats.length * screening.basePrice + productsTotal;
  }, [selectedSeats, screening, productsTotal]);

  const handleContinueToCheckout = async () => {
    if (!session?.user || !screening || selectedSeats.length === 0) {
      if (!session?.user) {
        router.push('/account');
      }
      return;
    }

    setIsCreatingOrder(true);
    setError(null);

    try {
      const userId =
        typeof (session.user as any).id === 'string'
          ? parseInt((session.user as any).id, 10)
          : (session.user as any).id;

      // Convert seatProducts Map to products array with seatId
      const products: Array<{
        productId: number;
        quantity: number;
        seatId: number;
      }> = [];
      seatProducts.forEach((productMap, seatId) => {
        productMap.forEach((quantity, productId) => {
          products.push({ productId, quantity, seatId });
        });
      });

      const result = await createOrder({
        userId,
        screeningId: screening.id,
        seatIds: selectedSeats,
        products,
      });

      if (result.success && 'order' in result && result.order) {
        router.push(SITE_URL.CHECKOUT(result.order.id));
      } else {
        setError(
          (result as { error?: string }).error ||
            'Պատվեր ստեղծելիս սխալ է տեղի ունեցել'
        );
        // Տեղերից մի մասը հնարավոր է զբաղվել է — թարմացնենք քարտեզը և
        // հանենք արդեն զբաղված տեղերն ընտրությունից
        const refreshed = await getScreeningById(screening.id);
        if (refreshed.success && refreshed.screening) {
          const updated = refreshed.screening as unknown as Screening;
          setScreening(updated);
          const occupied = new Set(updated.tickets.map((t) => t.seat.id));
          setSelectedSeats((prev) => prev.filter((id) => !occupied.has(id)));
        }
      }
    } catch (err) {
      console.error('Error creating order:', err);
      setError('Պատվեր ստեղծելիս սխալ է տեղի ունեցել');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Ամրագրել՝ վճարել մուտքի մոտ (հետվճարային)
  const openReserveWarning = () => {
    if (!session?.user || !screening || selectedSeats.length === 0) {
      if (!session?.user) {
        router.push('/account');
      }
      return;
    }
    setReserveWarningOpen(true);
  };

  const handleReserveAtCounter = async () => {
    if (!session?.user || !screening || selectedSeats.length === 0) {
      if (!session?.user) {
        router.push('/account');
      }
      return;
    }

    setReserveWarningOpen(false);
    setIsReserving(true);
    setError(null);

    try {
      const productsArr: Array<{
        productId: number;
        quantity: number;
        seatId: number;
      }> = [];
      seatProducts.forEach((productMap, seatId) => {
        productMap.forEach((quantity, productId) => {
          productsArr.push({ productId, quantity, seatId });
        });
      });

      const result = await createCounterReservation({
        screeningId: screening.id,
        seatIds: selectedSeats,
        products: productsArr,
      });

      if (result.success) {
        router.push(`${SITE_URL.TICKETS}?reserved=1`);
      } else {
        setError(result.error || 'Ամրագրում ստեղծելիս սխալ է տեղի ունեցել');
        const refreshed = await getScreeningById(screening.id);
        if (refreshed.success && refreshed.screening) {
          const updated = refreshed.screening as unknown as Screening;
          setScreening(updated);
          const occupied = new Set(updated.tickets.map((t) => t.seat.id));
          setSelectedSeats((prev) => prev.filter((id) => !occupied.has(id)));
        }
      }
    } catch (err) {
      console.error('Error reserving at counter:', err);
      setError('Ամրագրում ստեղծելիս սխալ է տեղի ունեցել');
    } finally {
      setIsReserving(false);
    }
  };

  // Group seats by row
  const seatsByRow = useMemo(() => {
    if (!screening?.hall.seats) return new Map<string, Seat[]>();
    const grouped = new Map<string, Seat[]>();
    screening.hall.seats.forEach((seat) => {
      if (!grouped.has(seat.row)) {
        grouped.set(seat.row, []);
      }
      grouped.get(seat.row)!.push(seat);
    });
    for (const [, seats] of grouped) {
      seats.sort((a, b) => b.number - a.number);
    }
    return grouped;
  }, [screening]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-xl text-gray-600">Բեռնվում է...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !screening) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center py-20">
            <p className="text-xl text-red-600 mb-4">
              {error || 'Ցուցադրությունը չի գտնվել'}
            </p>
            <Link
              href={SITE_URL.SCHEDULE}
              className="text-purple-600 hover:text-purple-700 underline"
            >
              Վերադառնալ ժամանակացույց
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-16 pb-32 lg:pb-20 mt-10 ">
      <div className="container mx-auto px-3 sm:px-4 max-w-6xl">
        {/* Movie Info — compact on mobile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex gap-3 items-center">
              {screening.movie.image && (
                <div className="relative w-14 h-20 shrink-0 overflow-hidden rounded-lg bg-gray-200">
                  <Image
                    src={screening.movie.image}
                    alt={screening.movie.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  href={SITE_URL.MOVIE_DETAIL(
                    screening.movie.slug || screening.movie.id
                  )}
                  className="font-bold text-gray-900 hover:text-purple-600 transition-colors text-base leading-tight line-clamp-2 block mb-1.5"
                >
                  {screening.movie.title}
                </Link>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(screening.startTime)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTime(screening.startTime)}–
                    {formatTime(screening.endTime)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {screening.hall.name}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-bold text-purple-600">
                  {screening.basePrice} ֏
                </div>
                <div className="text-xs text-gray-400">/ տոմս</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main layout */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
          {/* ── Seat Map ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <h2 className="text-base font-bold text-gray-900">
                  Ընտրեք նստատեղ
                </h2>
              </div>

              {/* Screen */}
              <div className="flex justify-center px-4 mb-4">
                <div className="relative w-full max-w-xs">
                  <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-80" />
                  <div className="h-1 bg-gradient-to-r from-purple-300/40 to-pink-300/40 rounded-full mt-0.5 mx-4" />
                  <p className="text-center text-xs text-gray-400 mt-1 tracking-widest uppercase">
                    Էկրան
                  </p>
                </div>
              </div>

              {/* Seats */}
              {screening.hall.seats && screening.hall.seats.length > 0 ? (
                <div className="px-2 pb-4 overflow-x-auto">
                  <div className="inline-block min-w-full">
                    <div className="space-y-2">
                      {Array.from(seatsByRow.entries()).map(([row, seats]) => (
                        <div key={row} className="flex items-center gap-1.5">
                          <div className="w-6 shrink-0 text-center text-xs font-semibold text-gray-400">
                            {row}
                          </div>
                          <div className="flex gap-4 justify-center flex-1">
                            {pairSeatsForDisplay(seats).map((pair) => {
                              const [a, b] = pair;
                              // Ցուցադրման կարգ՝ ձախ = մեծ համար (ինչպես նախկինում)
                              const left = b
                                ? a.number >= b.number
                                  ? a
                                  : b
                                : a;
                              const right = b
                                ? a.number >= b.number
                                  ? b
                                  : a
                                : null;

                              const renderSeatBtn = (
                                seat: Seat,
                                side: 'left' | 'right' | 'solo'
                              ) => {
                                const isSelected = selectedSeats.includes(
                                  seat.id
                                );
                                const isOccupied = occupiedSeatIds.has(seat.id);
                                const isMyPending = myPendingSeatIds.has(
                                  seat.id
                                );
                                const tone = seatToneClass({
                                  isMyPending,
                                  isOccupied,
                                  isSelected,
                                });
                                return (
                                  <button
                                    key={seat.id}
                                    type="button"
                                    onClick={() =>
                                      handleSeatClick(seat.id, isOccupied)
                                    }
                                    disabled={isOccupied || isMyPending}
                                    title={
                                      isMyPending
                                        ? `${row}${seat.number} — ձեր աթոռը, սպասում է վճարման`
                                        : `${row}${seat.number}`
                                    }
                                    className={`
                                      flex flex-col items-center justify-end gap-0.5
                                      flex-1 min-w-0 py-0.5 px-0.5
                                      transition-all duration-150 touch-manipulation select-none
                                      ${tone}
                                      ${isSelected ? 'scale-105 drop-shadow-sm' : ''}
                                      ${isOccupied || isMyPending ? 'cursor-not-allowed' : 'active:scale-95'}
                                      ${side === 'left' ? 'rounded-l-md' : ''}
                                      ${side === 'right' ? 'rounded-r-md' : ''}
                                      ${side === 'solo' ? 'rounded-md' : ''}
                                    `}
                                  >
                                    <SeatIcon
                                      className="w-6 h-6 sm:w-7 sm:h-7 shrink-0"
                                      filled={
                                        isOccupied || isSelected || isMyPending
                                      }
                                    />
                                    <span
                                      className={`text-[9px] font-medium leading-none ${
                                        isMyPending
                                          ? 'text-amber-600'
                                          : isSelected
                                            ? 'text-purple-600'
                                            : 'text-gray-400'
                                      }`}
                                    >
                                      {seat.number}
                                    </span>
                                  </button>
                                );
                              };

                              return (
                                <div
                                  key={`${row}-${left.id}-${right?.id ?? 'x'}`}
                                  className="relative inline-flex items-stretch rounded-t-lg rounded-b-md border border-gray-200/90 bg-gradient-to-b from-gray-50 to-white shadow-sm"
                                  title={
                                    right
                                      ? `Բազկաթոռ ${row}${left.number}–${right.number}`
                                      : `Աթոռ ${row}${left.number}`
                                  }
                                >
                                  {/* center armrest */}
                                  {right && (
                                    <div
                                      className="pointer-events-none absolute left-1/2 top-2.5 bottom-1.5 w-0.5 -translate-x-1/2 rounded-full bg-gray-300/80 z-10"
                                      aria-hidden
                                    />
                                  )}
                                  <div className="relative flex w-[4.25rem] sm:w-[5rem] pt-2.5">
                                    {renderSeatBtn(
                                      left,
                                      right ? 'left' : 'solo'
                                    )}
                                    {right && renderSeatBtn(right, 'right')}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 px-4">
                  <p className="text-base mb-1">Նստատեղեր չեն գտնվել</p>
                  <p className="text-sm text-gray-400">
                    Կապ հաստատեք ադմինիստրացիայի հետ
                  </p>
                </div>
              )}

              {/* Legend */}
              <div className="flex gap-4 justify-center px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <LoveseatIcon
                    className="w-8 h-4 text-gray-300"
                    filled={false}
                  />
                  <span className="text-xs text-gray-500">Ազատ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LoveseatIcon className="w-8 h-4 text-purple-600" filled />
                  <span className="text-xs text-gray-500">Ընտրված</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LoveseatIcon className="w-8 h-4 text-red-300" filled />
                  <span className="text-xs text-gray-500">Զբաղված</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LoveseatIcon className="w-8 h-4 text-amber-500" filled />
                  <span className="text-xs text-gray-500">Իմ վճարումը</span>
                </div>
              </div>
              {myPendingSeatIds.size > 0 && (
                <div className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Ունեք {myPendingSeatIds.size} աթոռ սպասող վճարման
                  {myPendingHoldUntil
                    ? ` (մոտ ${Math.max(
                        0,
                        Math.ceil(
                          (new Date(myPendingHoldUntil).getTime() -
                            Date.now()) /
                            60000
                        )
                      )} րոպե)`
                    : ''}
                  . Ավարտեք վճարումը կամ փոխեք դրամարկղ-ամրագրման «Իմ տոմսերը»
                  բաժնում։
                </div>
              )}
            </div>
          </div>

          {/* ── Desktop Order Summary ── */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-24">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Պատվերի ամփոփում
              </h2>

              {selectedSeats.length > 0 ? (
                <>
                  {/* Tickets */}
                  <div className="space-y-1.5 mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Տոմսեր
                    </p>
                    {selectedSeats.map((seatId) => {
                      const seat = screening.hall.seats.find(
                        (s) => s.id === seatId
                      );
                      return (
                        <div
                          key={seatId}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-gray-600">
                            Շարք {seat?.row}, {seat?.number}
                          </span>
                          <span className="font-medium text-gray-800">
                            {screening.basePrice} ֏
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Products per seat */}
                  {seatProducts.size > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Կինոբար
                      </p>
                      {Array.from(seatProducts.entries()).map(
                        ([seatId, productMap]) => {
                          if (productMap.size === 0) return null;
                          const seat = screening.hall.seats.find(
                            (s) => s.id === seatId
                          );
                          return Array.from(productMap.entries()).map(
                            ([productId, qty]) => {
                              const product = products.find(
                                (p) => p.id === productId
                              );
                              if (!product) return null;
                              return (
                                <div
                                  key={`${seatId}-${productId}`}
                                  className="flex justify-between text-sm"
                                >
                                  <span className="text-gray-500 truncate pr-2">
                                    {product.name}
                                    <span className="text-gray-400 text-xs ml-1">
                                      ×{qty} ({seat?.row}
                                      {seat?.number})
                                    </span>
                                  </span>
                                  <span className="font-medium text-gray-800 shrink-0">
                                    {(product.price * qty).toFixed(0)} ֏
                                  </span>
                                </div>
                              );
                            }
                          );
                        }
                      )}
                    </div>
                  )}

                  {/* Totals */}
                  <div className="border-t border-gray-100 pt-3 mb-4 space-y-1.5">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Տոմսեր ({selectedSeats.length})</span>
                      <span>
                        {(selectedSeats.length * screening.basePrice).toFixed(
                          0
                        )}{' '}
                        ֏
                      </span>
                    </div>
                    {productsTotal > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Կինոբար</span>
                        <span>{productsTotal.toFixed(0)} ֏</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-100">
                      <span className="font-semibold text-gray-700">
                        Ընդամենը
                      </span>
                      <span className="text-xl font-bold text-gray-900">
                        {totalPrice.toFixed(0)} ֏
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleContinueToCheckout}
                    disabled={isCreatingOrder || isReserving || !session?.user}
                    className={`w-full py-3 rounded-xl font-semibold text-white transition-all shadow-md ${
                      isCreatingOrder || isReserving || !session?.user
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:shadow-lg'
                    }`}
                  >
                    {isCreatingOrder ? 'Ստեղծվում է...' : 'Վճարել օնլայն →'}
                  </button>

                  <button
                    onClick={openReserveWarning}
                    disabled={isCreatingOrder || isReserving || !session?.user}
                    className={`mt-2 w-full py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                      isCreatingOrder || isReserving || !session?.user
                        ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                        : 'border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100'
                    }`}
                  >
                    {isReserving
                      ? 'Ամրագրվում է...'
                      : 'Ամրագրել, վճարել մուտքի մոտ'}
                  </button>
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-violet-700">
                    <Gift className="mt-0.5 h-3 w-3 shrink-0" />
                    Բոնուսային միավորները կուտակվում են դրամարկղում վճարելուց
                    հետո
                  </p>

                  {error && (
                    <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-400 text-center leading-relaxed">
                    Ամրագրելով՝ ընդունում եք{' '}
                    <Link
                      href="/refund"
                      target="_blank"
                      className="text-red-500 hover:underline"
                    >
                      Վերադարձի քաղաքականությունը
                    </Link>
                  </p>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Ticket className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Ընտրեք նստատեղ</p>
                </div>
              )}

              <Link
                href={SITE_URL.SCHEDULE}
                className="mt-4 w-full block text-center text-sm text-gray-400 hover:text-gray-700 transition-colors py-2"
              >
                ← Ժամանակացույց
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Bottom Bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0">
        <AnimatePresence>
          {selectedSeats.length > 0 && summaryExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white border-t border-gray-200 shadow-2xl px-4 pt-3 pb-2 max-h-64 overflow-y-auto"
            >
              {/* Tickets */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Տոմսեր
              </p>
              <div className="space-y-1.5 mb-2">
                {selectedSeats.map((seatId) => {
                  const seat = screening.hall.seats.find(
                    (s) => s.id === seatId
                  );
                  return (
                    <div key={seatId} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Շարք {seat?.row}, {seat?.number}
                      </span>
                      <span className="font-medium">
                        {screening.basePrice} ֏
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Products */}
              {seatProducts.size > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 mt-2">
                    Կինոբար
                  </p>
                  <div className="space-y-1.5 mb-2">
                    {Array.from(seatProducts.entries()).map(
                      ([seatId, productMap]) =>
                        Array.from(productMap.entries()).map(
                          ([productId, qty]) => {
                            const product = products.find(
                              (p) => p.id === productId
                            );
                            const seat = screening.hall.seats.find(
                              (s) => s.id === seatId
                            );
                            if (!product) return null;
                            return (
                              <div
                                key={`${seatId}-${productId}`}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-gray-500 truncate pr-2">
                                  {product.name}
                                  <span className="text-gray-400 text-xs ml-1">
                                    ×{qty} ({seat?.row}
                                    {seat?.number})
                                  </span>
                                </span>
                                <span className="font-medium shrink-0">
                                  {(product.price * qty).toFixed(0)} ֏
                                </span>
                              </div>
                            );
                          }
                        )
                    )}
                  </div>
                </>
              )}

              {/* Sub-totals */}
              <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Տոմսեր ({selectedSeats.length})</span>
                  <span>
                    {(selectedSeats.length * screening.basePrice).toFixed(0)} ֏
                  </span>
                </div>
                {productsTotal > 0 && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Կինոբար</span>
                    <span>{productsTotal.toFixed(0)} ֏</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400 text-center pt-2 pb-1">
                Ամրագրելով՝ ընդունում եք{' '}
                <Link href="/refund" target="_blank" className="text-red-500">
                  Վերադարձի քաղաքականությունը
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border-t border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Bottom action bar */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 safe-area-bottom ">
          {selectedSeats.length > 0 ? (
            <>
              {/* Price + toggle */}
              <button
                onClick={() => setSummaryExpanded((v) => !v)}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full shrink-0">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs text-gray-500 leading-none">
                    {selectedSeats.length} տոմս
                    {productsTotal > 0 && (
                      <span className="ml-1 text-purple-500">+ կինոբար</span>
                    )}
                  </div>
                  <div className="font-bold text-gray-900 text-base leading-tight">
                    {totalPrice.toFixed(0)} ֏
                  </div>
                </div>
                <div className="ml-1 text-gray-400">
                  {summaryExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </div>
              </button>

              {/* Action buttons */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={handleContinueToCheckout}
                  disabled={isCreatingOrder || isReserving || !session?.user}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-all ${
                    isCreatingOrder || isReserving || !session?.user
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 active:scale-95 shadow-lg shadow-purple-500/30'
                  }`}
                >
                  {isCreatingOrder ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    'Վճարել օնլայն →'
                  )}
                </button>
                <button
                  onClick={openReserveWarning}
                  disabled={isCreatingOrder || isReserving || !session?.user}
                  className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all border ${
                    isCreatingOrder || isReserving || !session?.user
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-purple-300 text-purple-700 bg-purple-50 active:scale-95 hover:bg-purple-100'
                  }`}
                >
                  {isReserving ? (
                    <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    'Ամրագրել, վճարել մուտքի մոտ'
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 text-sm text-gray-400 text-center">
                Ընտրեք նստատեղ
              </div>
              <Link
                href={SITE_URL.SCHEDULE}
                className="text-sm text-purple-600 font-medium"
              >
                ← Ժամանակացույց
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Product Selection Modal */}
      <AnimatePresence>
        {productModalOpen && currentSeatId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
            onClick={handleCancelSeatProducts}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col"
              style={{ maxHeight: '88dvh' }}
            >
              {/* Drag handle (mobile) */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Կինոբար</h2>
                  {getSeatInfo(currentSeatId) && (
                    <p className="text-xs text-gray-500">
                      Նստատեղ {getSeatInfo(currentSeatId)!.row}
                      {getSeatInfo(currentSeatId)!.number}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleCancelSeatProducts}
                  className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Picker steps */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {/* Քայլ 0՝ կատեգորիաներ + այլ ապրանքներ */}
                {pickerCategory == null && (
                  <div className="space-y-4">
                    {(popcornByCategory.popcorn.length > 0 ||
                      popcornByCategory.icedTea.length > 0) && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Ընտրեք տեսակը
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {popcornByCategory.popcorn.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPickerCategory('popcorn');
                                setPickerFlavorKey(null);
                              }}
                              className="relative flex items-stretch gap-3 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 text-left transition hover:border-amber-400 hover:shadow-md active:scale-[0.99]"
                            >
                              <div className="relative h-24 w-24 shrink-0 bg-amber-100 sm:h-28 sm:w-28">
                                {categoryCoverImage('popcorn') ? (
                                  <Image
                                    src={categoryCoverImage('popcorn')!}
                                    alt="Պոպկորն"
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-amber-700">
                                    <Popcorn className="h-10 w-10" />
                                  </div>
                                )}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col justify-center py-3 pr-3">
                                <p className="text-lg font-bold text-gray-900">
                                  Պոպկորն
                                </p>
                                <p className="text-sm text-gray-500">
                                  {flavorGroupsFor('popcorn').length} համ ·
                                  հետո չափը
                                </p>
                              </div>
                              {categoryCartQty('popcorn') > 0 && (
                                <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2.5 py-1 text-sm font-bold text-white">
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
                              className="relative flex items-stretch gap-3 overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 text-left transition hover:border-sky-400 hover:shadow-md active:scale-[0.99]"
                            >
                              <div className="relative h-24 w-24 shrink-0 bg-sky-100 sm:h-28 sm:w-28">
                                {categoryCoverImage('iced_tea') ? (
                                  <Image
                                    src={categoryCoverImage('iced_tea')!}
                                    alt="Սառը թեյ"
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-sky-700">
                                    <CupSoda className="h-10 w-10" />
                                  </div>
                                )}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col justify-center py-3 pr-3">
                                <p className="text-lg font-bold text-gray-900">
                                  Սառը թեյ
                                </p>
                                <p className="text-sm text-gray-500">
                                  {flavorGroupsFor('iced_tea').length} համ ·
                                  հետո չափը
                                </p>
                              </div>
                              {categoryCartQty('iced_tea') > 0 && (
                                <span className="absolute right-2 top-2 rounded-full bg-sky-500 px-2.5 py-1 text-sm font-bold text-white">
                                  {categoryCartQty('iced_tea')}
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {otherProducts.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Այլ ապրանքներ
                        </p>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                          {otherProducts.map((product) => {
                            const quantity =
                              currentSeatProducts.get(product.id) || 0;
                            return (
                              <div
                                key={product.id}
                                className={`overflow-hidden rounded-2xl border transition-all ${
                                  quantity > 0
                                    ? 'border-purple-300 bg-purple-50'
                                    : 'border-gray-100 bg-white'
                                }`}
                              >
                                <div className="relative aspect-square bg-gray-100">
                                  {product.image ? (
                                    <Image
                                      src={product.image}
                                      alt={product.name}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center">
                                      <ShoppingCart className="h-8 w-8 text-gray-300" />
                                    </div>
                                  )}
                                  {quantity > 0 && (
                                    <span className="absolute right-1.5 top-1.5 rounded-full bg-purple-600 px-2 py-0.5 text-xs font-bold text-white">
                                      {quantity}
                                    </span>
                                  )}
                                </div>
                                <div className="p-2.5">
                                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
                                    {product.name}
                                  </p>
                                  <p className="mt-1 text-sm font-bold text-purple-600">
                                    {product.price.toFixed(0)} ֏
                                  </p>
                                  <div className="mt-2 flex items-center justify-end gap-1.5">
                                    {quantity > 0 && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleProductQuantityChange(
                                              product.id,
                                              -1
                                            )
                                          }
                                          className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 active:scale-90"
                                        >
                                          <Minus className="h-3.5 w-3.5" />
                                        </button>
                                        <span className="w-5 text-center text-sm font-bold text-gray-900">
                                          {quantity}
                                        </span>
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleProductQuantityChange(
                                          product.id,
                                          1
                                        )
                                      }
                                      className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-white active:scale-90"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {quantityProducts.length === 0 &&
                      otherProducts.length === 0 && (
                        <div className="py-10 text-center">
                          <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-gray-200" />
                          <p className="text-sm text-gray-400">Ապրանքներ չկան</p>
                        </div>
                      )}
                  </div>
                )}

                {/* Քայլ 1՝ համեր */}
                {pickerCategory != null && pickerFlavorKey == null && (
                  <div>
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
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {activeFlavorGroups.map((group) => {
                        const inCart = flavorCartQty(group);
                        const cover = flavorCoverImage(group);
                        return (
                          <button
                            key={group.flavorKey}
                            type="button"
                            onClick={() =>
                              setPickerFlavorKey(group.flavorKey)
                            }
                            className={`relative overflow-hidden rounded-2xl border text-left transition ${
                              inCart > 0
                                ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200'
                                : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="relative aspect-square bg-gray-100">
                              {cover ? (
                                <Image
                                  src={cover}
                                  alt={group.displayName}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-gray-300">
                                  {pickerCategory === 'popcorn' ? (
                                    <Popcorn className="h-10 w-10" />
                                  ) : (
                                    <CupSoda className="h-10 w-10" />
                                  )}
                                </div>
                              )}
                              {inCart > 0 && (
                                <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-600 px-1.5 text-xs font-bold text-white">
                                  {inCart}
                                </span>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
                                {group.displayName}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Քայլ 2՝ չափ */}
                {pickerCategory != null &&
                  pickerFlavorKey != null &&
                  activeFlavorGroup && (
                    <div>
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
                            Ընտրեք չափը և քանակը
                          </p>
                        </div>
                      </div>
                      <div className="mx-auto grid max-w-lg grid-cols-2 gap-3">
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
                          const quantity =
                            currentSeatProducts.get(product.id) || 0;
                          return (
                            <div
                              key={sizeKey}
                              className={`overflow-hidden rounded-2xl border transition ${
                                quantity > 0
                                  ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200'
                                  : 'border-gray-200 bg-white'
                              }`}
                            >
                              <div className="relative aspect-square bg-gray-100">
                                {product.image ? (
                                  <Image
                                    src={product.image}
                                    alt={`${activeFlavorGroup.displayName} — ${label}`}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-300">
                                    {pickerCategory === 'popcorn' ? (
                                      <Popcorn className="h-10 w-10" />
                                    ) : (
                                      <CupSoda className="h-10 w-10" />
                                    )}
                                    <span className="text-sm font-bold text-gray-400">
                                      {label}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="p-3 text-center">
                                <p className="text-lg font-extrabold text-gray-900">
                                  {label}
                                </p>
                                <p className="mt-0.5 text-base font-bold text-purple-600">
                                  {product.price.toFixed(0)} ֏
                                </p>
                                <div className="mt-3 flex items-center justify-center gap-2">
                                  {quantity > 0 && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleProductQuantityChange(
                                            product.id,
                                            -1
                                          )
                                        }
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-600 active:scale-90"
                                      >
                                        <Minus className="h-4 w-4" />
                                      </button>
                                      <span className="w-6 text-center text-base font-bold text-gray-900">
                                        {quantity}
                                      </span>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleProductQuantityChange(
                                        product.id,
                                        1
                                      )
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white active:scale-90"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 px-4 py-4 bg-white">
                {Array.from(currentSeatProducts.values()).reduce(
                  (s, q) => s + q,
                  0
                ) > 0 && (
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-gray-500">Ընտրված ապրանքներ</span>
                    <span className="font-semibold text-gray-900">
                      {Array.from(currentSeatProducts.values()).reduce(
                        (s, q) => s + q,
                        0
                      )}{' '}
                      հատ
                    </span>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelSeatProducts}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
                  >
                    Բաց թողնել
                  </button>
                  <button
                    onClick={handleConfirmSeatProducts}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition-all shadow-md"
                  >
                    Ավելացնել →
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ամրագրման նախազգուշացում — վճարել մուտքի մոտ */}
      <AnimatePresence>
        {reserveWarningOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
            onClick={() => !isReserving && setReserveWarningOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            >
              <div className="px-5 pt-5 pb-2">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="text-center text-lg font-bold text-gray-900">
                  Խնդրում ենք լինել բարեխիղճ
                </h3>
                <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-gray-600">
                  <p>
                    Այս տարբերակով տեղերը պահվում են ձեզ համար մինչև մուտքի մոտ
                    վճարելը։ Եթե ամրագրեք և չգաք, այդ տեղերը մնում են զբաղված,
                    և այլ հանդիսատեսներ չեն կարող դրանք վերցնել։
                  </p>
                  <p>
                    Խնդրում ենք ամրագրել միայն այն դեպքում, երբ իսկապես
                    պլանավորում եք գալ և վճարել դրամարկղում։
                  </p>
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950">
                    Կրկնակի չեղարկումների կամ չգալու դեպքում հաշիվը կարող է
                    արգելափակվել, և այս հնարավորությունից կզրկվեք։
                  </p>
                  <p className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-violet-900">
                    <Gift className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    <span>
                      Բոնուսային միավորները <strong>չեն գրվում</strong>{' '}
                      ամրագրելիս։ Դրանք կուտակվում են միայն դրամարկղում
                      վճարելուց հետո՝ ձեր հաշվին։
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleReserveAtCounter}
                  disabled={isReserving}
                  className="flex-1 rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isReserving
                    ? 'Ամրագրվում է...'
                    : 'Հասկանում եմ, ամրագրել'}
                </button>
                <button
                  type="button"
                  onClick={() => setReserveWarningOpen(false)}
                  disabled={isReserving}
                  className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 disabled:opacity-60"
                >
                  Չեղարկել
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
