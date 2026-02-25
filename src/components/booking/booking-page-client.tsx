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
  Filter,
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

  const totalPrice = useMemo(() => {
    if (!screening) return 0;
    return selectedSeats.length * screening.basePrice;
  }, [selectedSeats, screening]);

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
        setError((result as { error?: string }).error || 'Պատվեր ստեղծելիս սխալ է տեղի ունեցել');
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Տոմսերի ամրագրում
          </h1>

          {/* Movie Info */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-6">
              {screening.movie.image && (
                <div className="relative w-full md:w-32 h-48 md:h-40 overflow-hidden rounded-lg bg-gray-200">
                  <Image
                    src={
                      screening.movie.image ||
                      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800'
                    }
                    alt={screening.movie.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <div className="flex-1">
                <Link
                  href={SITE_URL.MOVIE_DETAIL(
                    screening.movie.slug || screening.movie.id
                  )}
                  className="text-2xl font-bold text-gray-900 hover:text-purple-600 transition-colors mb-3 block"
                >
                  {screening.movie.title}
                </Link>

                <div className="space-y-2 text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    <span>{formatDate(screening.startTime)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span>
                      {formatTime(screening.startTime)} -{' '}
                      {formatTime(screening.endTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    <span>{screening.hall.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5" />
                    <span>{screening.movie.duration} րոպե</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Seat Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Ընտրեք նստատեղերը
              </h2>

              {/* Screen */}
              <div className="mb-8 text-center pl-10">
                <div className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-2 rounded-t-[50px] w-[500px]">
                  <span className="font-semibold">ԷԿՐԱՆ</span>
                </div>
              </div>

              {/* Seats Grid */}
              {screening.hall.seats && screening.hall.seats.length > 0 ? (
                <div className="space-y-2 mb-6">
                  {Array.from(seatsByRow.entries()).map(([row, seats]) => (
                    <div key={row} className="flex items-center gap-2">
                      <div className="w-8 text-center font-semibold text-gray-700">
                        {row}
                      </div>
                      <div className="flex gap-1.5 flex-1 justify-center items-end">
                        {seats.map((seat) => {
                          const isSelected = selectedSeats.includes(seat.id);
                          const isOccupied = occupiedSeatIds.has(seat.id);

                          return (
                            <button
                              key={seat.id}
                              onClick={() =>
                                handleSeatClick(seat.id, isOccupied)
                              }
                              disabled={isOccupied}
                              className={`
                                flex flex-col items-center justify-end gap-0.5 p-1 w-11 min-w-0 rounded-b-md rounded-t transition-all duration-200
                                ${
                                  isOccupied
                                    ? 'text-red-400 cursor-not-allowed opacity-90'
                                    : isSelected
                                      ? 'text-purple-600 scale-110 drop-shadow-md'
                                      : 'text-gray-400 hover:text-gray-600 hover:scale-105'
                                }
                              `}
                              title={`${row}${seat.number}`}
                            >
                              <SeatIcon
                                className="w-7 h-7 shrink-0"
                                filled={isOccupied || isSelected}
                              />
                              <span
                                className={`text-[10px] font-medium leading-none ${
                                  isSelected
                                    ? 'text-purple-600'
                                    : 'text-gray-500'
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
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">Նստատեղեր չեն գտնվել</p>
                  <p className="text-sm">
                    Խնդրում ենք կապ հաստատել ադմինիստրացիայի հետ
                  </p>
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap gap-6 justify-center text-sm items-center">
                <div className="flex items-center gap-2">
                  <SeatIcon className="w-6 h-6 text-gray-400" filled={false} />
                  <span className="text-gray-600">Ազատ</span>
                </div>
                <div className="flex items-center gap-2">
                  <SeatIcon className="w-6 h-6 text-purple-600" filled />
                  <span className="text-gray-600">Ընտրված</span>
                </div>
                <div className="flex items-center gap-2">
                  <SeatIcon className="w-6 h-6 text-red-400" filled />
                  <span className="text-gray-600">Զբաղված</span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-24">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Պատվերի ամփոփում
              </h2>

              {selectedSeats.length > 0 ? (
                <>
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="w-5 h-5" />
                      <span>{selectedSeats.length} տոմս</span>
                    </div>

                    <div className="space-y-2">
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
                              {seat?.row}
                              {seat?.number} - {screening.basePrice} ֏
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t pt-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Ընդամենը</span>
                      <span className="text-2xl font-bold text-gray-900">
                        {totalPrice.toFixed(0)} ֏
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleContinueToCheckout}
                    disabled={isCreatingOrder || !session?.user}
                    className={`w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg ${
                      isCreatingOrder || !session?.user
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    {isCreatingOrder ? 'Ստեղծվում է...' : 'Շարունակել'}
                  </button>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Ընտրեք նստատեղեր</p>
                </div>
              )}

              <Link
                href={SITE_URL.SCHEDULE}
                className="mt-4 w-full block text-center px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Վերադառնալ ժամանակացույց
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Product Selection Modal */}
      <AnimatePresence>
        {productModalOpen && currentSeatId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCancelSeatProducts}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      Ընտրեք ապրանքներ
                    </h2>
                    {getSeatInfo(currentSeatId) && (
                      <p className="text-white/90">
                        Նստատեղ: {getSeatInfo(currentSeatId)!.row}
                        {getSeatInfo(currentSeatId)!.number}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleCancelSeatProducts}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Փնտրել ապրանք..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === null
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Բոլորը
                    </button>
                    {availableCategories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                          selectedCategory === category
                            ? 'bg-purple-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {getCategoryLabel(category)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map((product) => {
                      const quantity = currentSeatProducts.get(product.id) || 0;
                      return (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`bg-white rounded-xl border-2 p-4 transition-all ${
                            quantity > 0
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          {product.image && (
                            <div className="relative w-full h-32 mb-3 rounded-lg overflow-hidden bg-gray-100">
                              <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-lg font-bold text-purple-600">
                              {product.price.toFixed(0)} ֏
                            </span>
                            <div className="flex items-center gap-2">
                              {quantity > 0 && (
                                <button
                                  onClick={() =>
                                    handleProductQuantityChange(product.id, -1)
                                  }
                                  className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                              )}
                              {quantity > 0 && (
                                <span className="w-8 text-center font-semibold text-gray-900">
                                  {quantity}
                                </span>
                              )}
                              <button
                                onClick={() =>
                                  handleProductQuantityChange(product.id, 1)
                                }
                                className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">
                      {searchQuery || selectedCategory
                        ? 'Ապրանքներ չեն գտնվել'
                        : 'Ապրանքներ չկան'}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-600">Ընտրված ապրանքներ:</span>
                  <span className="font-semibold text-gray-900">
                    {Array.from(currentSeatProducts.values()).reduce(
                      (sum, qty) => sum + qty,
                      0
                    )}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelSeatProducts}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Չեղարկել
                  </button>
                  <button
                    onClick={handleConfirmSeatProducts}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
                  >
                    Հաստատել
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
