'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  Users,
  Film,
  ArrowLeft,
  Info,
  AlertCircle,
  ShoppingCart,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SITE_URL } from '@/utils/consts';
import { getScreeningById } from '@/app/actions/screenings';

interface ScreeningDetailPageClientProps {
  screeningId: string;
}

interface Screening {
  id: number;
  movie: {
    id: number;
    title: string;
    slug?: string | null;
    image?: string | null;
    duration: number;
    description?: string | null;
    genre?: string | null;
    rating?: number | null;
  };
  hall: {
    id: number;
    name: string;
    capacity: number;
    seats?: Array<{
      id: number;
      row: string;
      number: number;
      seatType: string;
    }>;
  };
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
  tickets?: Array<{
    id: number;
    seat: {
      id: number;
      row: string;
      number: number;
    };
    status: 'reserved' | 'paid' | 'used' | 'cancelled';
    order?: {
      id: number;
      orderItems: Array<{
        id: number;
        quantity: number;
        price: number;
        product: {
          id: number;
          name: string;
          image?: string | null;
          category: string;
        };
      }>;
    } | null;
  }>;
}

export default function ScreeningDetailPageClient({
  screeningId,
}: ScreeningDetailPageClientProps) {
  const [screening, setScreening] = useState<Screening | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadScreening = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getScreeningById(parseInt(screeningId, 10));
        if (result.success && result.screening) {
          setScreening(result.screening as Screening);
        } else {
          setError(result.error || 'Ցուցադրությունը չի գտնվել');
        }
      } catch (err) {
        console.error('Error loading screening:', err);
        setError('Ցուցադրությունը բեռնելիս սխալ է տեղի ունեցել');
      } finally {
        setLoading(false);
      }
    };

    loadScreening();
  }, [screeningId]);

  // Collect all products from orders
  const orderedProducts = useMemo(() => {
    if (!screening?.tickets) return [];

    const productMap = new Map<
      number,
      {
        id: number;
        name: string;
        image?: string | null;
        category: string;
        totalQuantity: number;
        totalPrice: number;
      }
    >();

    screening.tickets.forEach((ticket) => {
      if (ticket.order?.orderItems) {
        ticket.order.orderItems.forEach((item) => {
          const existing = productMap.get(item.product.id);
          if (existing) {
            existing.totalQuantity += item.quantity;
            existing.totalPrice += item.price * item.quantity;
          } else {
            productMap.set(item.product.id, {
              id: item.product.id,
              name: item.product.name,
              image: item.product.image,
              category: item.product.category,
              totalQuantity: item.quantity,
              totalPrice: item.price * item.quantity,
            });
          }
        });
      }
    });

    return Array.from(productMap.values());
  }, [screening?.tickets]);

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('hy-AM', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}ժ ${mins}ր`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Բեռնվում է...</p>
        </div>
      </div>
    );
  }

  if (error || !screening) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <p className="text-xl text-gray-600 mb-4">
            {error || 'Ցուցադրությունը չի գտնվել'}
          </p>
          <Link
            href={SITE_URL.SCHEDULE}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Վերադառնալ գրաֆիկին
          </Link>
        </div>
      </div>
    );
  }

  // Calculate available seats from hall capacity and tickets
  const totalSeats = screening.hall.capacity;
  const occupiedSeats = screening.tickets?.length || 0;
  const availableSeats = totalSeats - occupiedSeats;

  // Check if screening is upcoming (hasn't started yet)
  // Screening is considered upcoming only if startTime is in the future
  const now = new Date();
  const startTime = new Date(screening.startTime);
  const endTime = new Date(screening.endTime);
  const isUpcoming = startTime > now;
  const isPast = endTime < now;
  const isOngoing = startTime <= now && endTime >= now;

  const occupancyRate = (occupiedSeats / totalSeats) * 100;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Back Button */}
        <Link
          href={SITE_URL.SCHEDULE}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Վերադառնալ գրաֆիկին</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Movie Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-lg overflow-hidden"
            >
              <div className="flex flex-col md:flex-row">
                {/* Movie Image */}
                <div className="relative w-full md:w-64 h-96 md:h-auto">
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

                {/* Movie Details */}
                <div className="flex-1 p-6">
                  <Link
                    href={SITE_URL.MOVIE_DETAIL(
                      screening.movie.slug || screening.movie.id
                    )}
                    className="text-3xl font-bold text-gray-900 hover:text-purple-600 transition-colors mb-4 block"
                  >
                    {screening.movie.title}
                  </Link>

                  {screening.movie.rating && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-2xl font-bold text-purple-600">
                        {screening.movie.rating.toFixed(1)}
                      </span>
                      <span className="text-gray-500">/ 10</span>
                    </div>
                  )}

                  {screening.movie.genre && (
                    <div className="flex items-center gap-2 mb-4">
                      <Film className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-600">
                        {screening.movie.genre}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">
                      Տևողություն: {formatDuration(screening.movie.duration)}
                    </span>
                  </div>

                  {screening.movie.description && (
                    <div className="mt-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Նկարագրություն
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        {screening.movie.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Screening Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Ցուցադրության մանրամասներ
              </h2>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-purple-600" />
                  <div>
                    <div className="text-sm text-gray-500">Ամսաթիվ</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatDate(screening.startTime)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <div>
                    <div className="text-sm text-gray-500">Ժամանակ</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatTime(screening.startTime)} -{' '}
                      {formatTime(screening.endTime)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-purple-600" />
                  <div>
                    <div className="text-sm text-gray-500">Դահլիճ</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {screening.hall.name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Ticket className="w-6 h-6 text-purple-600" />
                  <div>
                    <div className="text-sm text-gray-500">Գին</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {screening.basePrice.toFixed(0)} ֏
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Seats Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Նստատեղերի վիճակ
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">Առկա նստատեղեր</span>
                  </div>
                  <span className="text-2xl font-bold text-green-600">
                    {availableSeats}
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${occupancyRate}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Զբաղված: {occupiedSeats}</span>
                  <span>Ընդամենը: {totalSeats}</span>
                </div>

                {!isUpcoming && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <div className="font-semibold text-blue-900">
                        {isPast
                          ? 'Ցուցադրությունը արդեն անցել է'
                          : isOngoing
                            ? 'Ցուցադրությունը արդեն սկսվել է'
                            : 'Ցուցադրությունը արդեն անցել է'}
                      </div>
                      <div className="text-sm text-blue-700">
                        Այս ցուցադրության համար տոմսեր ամրագրել հնարավոր չէ:
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Ordered Products Card */}
            {orderedProducts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-xl shadow-lg p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingCart className="w-6 h-6 text-purple-600" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Պատվիրված ապրանքներ
                  </h2>
                </div>

                <div className="space-y-3">
                  {orderedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {product.image && (
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                            <Image
                              src={product.image}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900">
                            {product.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            Քանակ: {product.totalQuantity}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-purple-600">
                          {product.totalPrice.toFixed(0)} ֏
                        </div>
                        <div className="text-xs text-gray-500">
                          {(product.totalPrice / product.totalQuantity).toFixed(
                            0
                          )}{' '}
                          ֏/հատ
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">
                      Ընդամենը ապրանքներ
                    </span>
                    <span className="text-xl font-bold text-purple-600">
                      {orderedProducts
                        .reduce((sum, p) => sum + p.totalPrice, 0)
                        .toFixed(0)}{' '}
                      ֏
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-lg p-6 sticky top-24"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Արագ գործողություններ
              </h3>

              {isUpcoming ? (
                <div className="space-y-4">
                  <Link
                    href={SITE_URL.BOOKING(screening.id)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all text-center block"
                  >
                    Ամրագրել տոմսեր
                  </Link>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">Տոմսի գին</div>
                    <div className="text-3xl font-bold text-gray-900">
                      {screening.basePrice.toFixed(0)} ֏
                    </div>
                    <div className="text-xs text-gray-500 mt-1">մեկ տոմս</div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">
                      Առկա նստատեղեր
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {availableSeats}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {totalSeats} ընդամենը
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-gray-600 mb-2">
                    {isPast
                      ? 'Ցուցադրությունը արդեն անցել է'
                      : isOngoing
                        ? 'Ցուցադրությունը արդեն սկսվել է'
                        : 'Ցուցադրությունը արդեն անցել է'}
                  </p>
                  <Link
                    href={SITE_URL.SCHEDULE}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Դիտել այլ ցուցադրություններ
                  </Link>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
