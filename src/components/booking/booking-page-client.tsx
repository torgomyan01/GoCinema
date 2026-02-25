'use client';

import { useState, useMemo, useEffect } from 'react';
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
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

/** Cinema seat icon – back + seat cushion */
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
      {/* seat cushion */}
      <rect x="2" y="12" width="24" height="8" rx="1.5" />
      {/* seat back */}
      <path d="M5 12V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
    </svg>
  );
}
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SITE_URL } from '@/utils/consts';
import { getScreeningById } from '@/app/actions/screenings';
import { createOrder } from '@/app/actions/orders';
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
    seat: {
      id: number;
      row: string;
      number: number;
    };
    status: string;
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
  const [error, setError] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [currentSeatId, setCurrentSeatId] = useState<number | null>(null);
  const [currentSeatProducts, setCurrentSeatProducts] = useState<
    Map<number, number>
  >(new Map());
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  // Get occupied seat IDs from tickets
  const occupiedSeatIds = useMemo(() => {
    if (!screening) return new Set<number>();
    return new Set(screening.tickets.map((ticket) => ticket.seat.id));
  }, [screening]);

  // Check if user is logged in
  useEffect(() => {
    if (!session?.user && !isLoading) {
      router.push('/account');
    }
  }, [session, router, isLoading]);

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('hy-AM', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

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
    setSearchQuery('');
    setSelectedCategory(null);
  };

  const handleCancelSeatProducts = () => {
    setProductModalOpen(false);
    setCurrentSeatId(null);
    setCurrentSeatProducts(new Map());
    setSearchQuery('');
    setSelectedCategory(null);
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

  const getCategoryLabel = (category: string) => {
    const categoryLabels: Record<string, string> = {
      snack: 'Նախուտեստ',
      drink: 'Խմիչք',
      combo: 'Կոմբո',
      popcorn: 'Պոպկորն',
      soda: 'Գազավորված խմիչք',
      candy: 'Քաղցրավենիք',
      hot_dog: 'Հոթ-դոգ',
      nachos: 'Նաչոս',
      coffee: 'Սրճարանային խմիչք',
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
    return categoryLabels[category] || category;
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [products, selectedCategory, searchQuery]);

  const availableCategories = useMemo(() => {
    const categories = new Set(products.map((p) => p.category));
    return Array.from(categories).sort();
  }, [products]);

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
      }
    } catch (err) {
      console.error('Error creating order:', err);
      setError('Պատվեր ստեղծելիս սխալ է տեղի ունեցել');
    } finally {
      setIsCreatingOrder(false);
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
    <div className="min-h-screen bg-slate-50 pt-16 pb-32 lg:pb-20 mt-10">
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
                    <div className="space-y-1.5">
                      {Array.from(seatsByRow.entries()).map(([row, seats]) => (
                        <div key={row} className="flex items-center gap-1">
                          {/* Row label */}
                          <div className="w-6 shrink-0 text-center text-xs font-semibold text-gray-400">
                            {row}
                          </div>
                          {/* Seats */}
                          <div className="flex gap-1 justify-center flex-1">
                            {seats.map((seat) => {
                              const isSelected = selectedSeats.includes(
                                seat.id
                              );
                              const isOccupied = occupiedSeatIds.has(seat.id);
                              return (
                                <button
                                  key={seat.id}
                                  onClick={() =>
                                    handleSeatClick(seat.id, isOccupied)
                                  }
                                  disabled={isOccupied}
                                  title={`${row}${seat.number}`}
                                  className={`
                                    flex flex-col items-center justify-end gap-0.5
                                    w-9 h-10 sm:w-10 sm:h-11 rounded-t-sm rounded-b-md
                                    transition-all duration-150 touch-manipulation select-none
                                    ${
                                      isOccupied
                                        ? 'text-red-300 cursor-not-allowed opacity-70'
                                        : isSelected
                                          ? 'text-purple-600 scale-110 drop-shadow-md'
                                          : 'text-gray-300 active:scale-95 hover:text-gray-500'
                                    }
                                  `}
                                >
                                  <SeatIcon
                                    className="w-6 h-6 sm:w-7 sm:h-7 shrink-0"
                                    filled={isOccupied || isSelected}
                                  />
                                  <span
                                    className={`text-[9px] font-medium leading-none ${
                                      isSelected
                                        ? 'text-purple-600'
                                        : 'text-gray-400'
                                    }`}
                                  >
                                    {seat.number}
                                  </span>
                                </button>
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
              <div className="flex gap-4 justify-center px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-1.5">
                  <SeatIcon className="w-5 h-5 text-gray-300" filled={false} />
                  <span className="text-xs text-gray-500">Ազատ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <SeatIcon className="w-5 h-5 text-purple-600" filled />
                  <span className="text-xs text-gray-500">Ընտրված</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <SeatIcon className="w-5 h-5 text-red-300" filled />
                  <span className="text-xs text-gray-500">Զբաղված</span>
                </div>
              </div>
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
                      const seat = screening.hall.seats.find((s) => s.id === seatId);
                      return (
                        <div key={seatId} className="flex justify-between text-sm">
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
                      {Array.from(seatProducts.entries()).map(([seatId, productMap]) => {
                        if (productMap.size === 0) return null;
                        const seat = screening.hall.seats.find((s) => s.id === seatId);
                        return Array.from(productMap.entries()).map(([productId, qty]) => {
                          const product = products.find((p) => p.id === productId);
                          if (!product) return null;
                          return (
                            <div key={`${seatId}-${productId}`} className="flex justify-between text-sm">
                              <span className="text-gray-500 truncate pr-2">
                                {product.name}
                                <span className="text-gray-400 text-xs ml-1">
                                  ×{qty} ({seat?.row}{seat?.number})
                                </span>
                              </span>
                              <span className="font-medium text-gray-800 shrink-0">
                                {(product.price * qty).toFixed(0)} ֏
                              </span>
                            </div>
                          );
                        });
                      })}
                    </div>
                  )}

                  {/* Totals */}
                  <div className="border-t border-gray-100 pt-3 mb-4 space-y-1.5">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Տոմսեր ({selectedSeats.length})</span>
                      <span>{(selectedSeats.length * screening.basePrice).toFixed(0)} ֏</span>
                    </div>
                    {productsTotal > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Կինոբար</span>
                        <span>{productsTotal.toFixed(0)} ֏</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-100">
                      <span className="font-semibold text-gray-700">Ընդամենը</span>
                      <span className="text-xl font-bold text-gray-900">
                        {totalPrice.toFixed(0)} ֏
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleContinueToCheckout}
                    disabled={isCreatingOrder || !session?.user}
                    className={`w-full py-3 rounded-xl font-semibold text-white transition-all shadow-md ${
                      isCreatingOrder || !session?.user
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:shadow-lg'
                    }`}
                  >
                    {isCreatingOrder ? 'Ստեղծվում է...' : 'Շարունակել →'}
                  </button>
                  <p className="mt-2 text-xs text-gray-400 text-center leading-relaxed">
                    Ամրագրելով՝ ընդունում եք{' '}
                    <Link href="/refund" target="_blank" className="text-red-500 hover:underline">
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <AnimatePresence>
          {selectedSeats.length > 0 && summaryExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white border-t border-gray-200 shadow-2xl px-4 pt-3 pb-2 max-h-64 overflow-y-auto"
            >
              {/* Tickets */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Տոմսեր</p>
              <div className="space-y-1.5 mb-2">
                {selectedSeats.map((seatId) => {
                  const seat = screening.hall.seats.find((s) => s.id === seatId);
                  return (
                    <div key={seatId} className="flex justify-between text-sm">
                      <span className="text-gray-600">Շարք {seat?.row}, {seat?.number}</span>
                      <span className="font-medium">{screening.basePrice} ֏</span>
                    </div>
                  );
                })}
              </div>

              {/* Products */}
              {seatProducts.size > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 mt-2">Կինոբար</p>
                  <div className="space-y-1.5 mb-2">
                    {Array.from(seatProducts.entries()).map(([seatId, productMap]) =>
                      Array.from(productMap.entries()).map(([productId, qty]) => {
                        const product = products.find((p) => p.id === productId);
                        const seat = screening.hall.seats.find((s) => s.id === seatId);
                        if (!product) return null;
                        return (
                          <div key={`${seatId}-${productId}`} className="flex justify-between text-sm">
                            <span className="text-gray-500 truncate pr-2">
                              {product.name}
                              <span className="text-gray-400 text-xs ml-1">×{qty} ({seat?.row}{seat?.number})</span>
                            </span>
                            <span className="font-medium shrink-0">{(product.price * qty).toFixed(0)} ֏</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {/* Sub-totals */}
              <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Տոմսեր ({selectedSeats.length})</span>
                  <span>{(selectedSeats.length * screening.basePrice).toFixed(0)} ֏</span>
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

        {/* Bottom action bar */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 safe-area-bottom">
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

              {/* Continue button */}
              <button
                onClick={handleContinueToCheckout}
                disabled={isCreatingOrder || !session?.user}
                className={`shrink-0 px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all ${
                  isCreatingOrder || !session?.user
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 active:scale-95 shadow-lg shadow-purple-500/30'
                }`}
              >
                {isCreatingOrder ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Շարունակել →'
                )}
              </button>
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

              {/* Search + Categories */}
              <div className="px-4 py-3 border-b border-gray-100 space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Փնտրել..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                      selectedCategory === null
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Բոլորը
                  </button>
                  {availableCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                        selectedCategory === category
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {getCategoryLabel(category)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products list */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {filteredProducts.length > 0 ? (
                  <div className="space-y-2">
                    {filteredProducts.map((product) => {
                      const quantity = currentSeatProducts.get(product.id) || 0;
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            quantity > 0
                              ? 'border-purple-300 bg-purple-50'
                              : 'border-gray-100 bg-white'
                          }`}
                        >
                          {product.image ? (
                            <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                              <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-14 h-14 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center">
                              <ShoppingCart className="w-6 h-6 text-gray-300" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm leading-tight">
                              {product.name}
                            </p>
                            {product.description && (
                              <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                                {product.description}
                              </p>
                            )}
                            <p className="text-sm font-bold text-purple-600 mt-1">
                              {product.price.toFixed(0)} ֏
                            </p>
                          </div>
                          {/* Quantity controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            {quantity > 0 && (
                              <>
                                <button
                                  onClick={() =>
                                    handleProductQuantityChange(product.id, -1)
                                  }
                                  className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center active:scale-90 transition-transform"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-5 text-center font-bold text-gray-900 text-sm">
                                  {quantity}
                                </span>
                              </>
                            )}
                            <button
                              onClick={() =>
                                handleProductQuantityChange(product.id, 1)
                              }
                              className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center active:scale-90 transition-transform"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">
                      {searchQuery || selectedCategory
                        ? 'Ապրանքներ չեն գտնվել'
                        : 'Ապրանքներ չկան'}
                    </p>
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
    </div>
  );
}
