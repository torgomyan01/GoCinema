'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Film,
  Star,
  Play,
  ArrowLeft,
  Ticket,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SITE_URL } from '@/utils/consts';

interface MovieDetailPageClientProps {
  movie: {
    id: number;
    title: string;
    slug?: string | null;
    image?: string | null;
    duration: number;
    description?: string | null;
    genre?: string | null;
    rating?: number | null;
    releaseDate: Date | string;
    trailerUrl?: string | null;
    screenings?: Array<{
      id: number;
      startTime: Date | string;
      endTime: Date | string;
      basePrice: number;
      hall: {
        id: number;
        name: string;
        capacity: number;
      };
      tickets: Array<{
        id: number;
      }>;
    }>;
  };
}

export default function MovieDetailPageClient({
  movie,
}: MovieDetailPageClientProps) {
  const router = useRouter();
  const [showTrailer, setShowTrailer] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('hy-AM', {
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

  // Group screenings by date
  const screeningsByDate = useMemo(() => {
    const grouped = new Map<string, typeof movie.screenings>();

    movie.screenings?.forEach((screening) => {
      const date = formatDate(screening.startTime);
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(screening);
    });

    return grouped;
  }, [movie.screenings]);

  // Type helper for screening
  type ScreeningType = NonNullable<typeof movie.screenings>[number];

  // Calculate available seats for each screening
  const getAvailableSeats = (screening: ScreeningType) => {
    return screening.hall.capacity - (screening.tickets?.length || 0);
  };

  const isUpcoming = (screening: ScreeningType) => {
    return new Date(screening.startTime) > new Date();
  };

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string | null | undefined) => {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
    );
    return match ? match[1] : null;
  };

  const trailerVideoId = getYouTubeVideoId(movie.trailerUrl);

  // Get unique dates for date selection
  const availableDates = useMemo(() => {
    if (!movie.screenings) return [];
    const dates = new Set<string>();
    movie.screenings
      .filter((s) => isUpcoming(s))
      .forEach((screening) => {
        dates.add(formatDate(screening.startTime));
      });
    return Array.from(dates).sort((a, b) => {
      const dateA = new Date(
        movie.screenings!.find((s) => formatDate(s.startTime) === a)!.startTime
      );
      const dateB = new Date(
        movie.screenings!.find((s) => formatDate(s.startTime) === b)!.startTime
      );
      return dateA.getTime() - dateB.getTime();
    });
  }, [movie.screenings]);

  // Get screenings for selected date
  const screeningsForSelectedDate = useMemo(() => {
    if (!selectedDate || !movie.screenings) return [];
    return movie.screenings.filter(
      (s) => formatDate(s.startTime) === selectedDate && isUpcoming(s)
    );
  }, [selectedDate, movie.screenings]);

  const handleBookingClick = () => {
    if (
      movie.screenings &&
      movie.screenings.filter((s) => isUpcoming(s)).length > 0
    ) {
      setShowBookingModal(true);
      // Auto-select first available date
      if (availableDates.length > 0) {
        setSelectedDate(availableDates[0]);
      }
    }
  };

  const handleScreeningSelect = (screeningId: number) => {
    router.push(SITE_URL.BOOKING(screeningId));
  };

  const handleCloseModal = () => {
    setShowBookingModal(false);
    setSelectedDate(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="relative w-full h-[70vh] min-h-[500px] overflow-hidden">
        {movie.image && (
          <div className="absolute inset-0">
            <Image
              src={movie.image}
              alt={movie.title}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          </div>
        )}
        <div className="relative z-10 container mx-auto px-4 h-full flex flex-col justify-end pb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <Link
              href={SITE_URL.MOVIES}
              className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Վերադառնալ ֆիլմերին</span>
            </Link>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              {movie.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-white/90 mb-6">
              {movie.rating && (
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-xl font-semibold">
                    {movie.rating.toFixed(1)}
                  </span>
                </div>
              )}
              {movie.genre && (
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5" />
                  <span>{movie.genre}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{formatDuration(movie.duration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{formatDate(movie.releaseDate)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              {movie.screenings &&
                movie.screenings.filter((s) => isUpcoming(s)).length > 0 && (
                  <button
                    onClick={handleBookingClick}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Ticket className="w-5 h-5" />
                    Ամրագրել տոմս
                  </button>
                )}
              {trailerVideoId && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="inline-flex items-center gap-2 px-6 py-4 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-lg font-semibold text-lg transition-all duration-300 border border-white/20"
                >
                  <Play className="w-5 h-5 fill-white" />
                  Դիտել թրեյլեր
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Trailer Modal */}
      <AnimatePresence>
        {showTrailer && trailerVideoId && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowTrailer(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowTrailer(false)}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <iframe
                src={`https://www.youtube.com/embed/${trailerVideoId}?autoplay=1`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      Ընտրեք ցուցադրություն
                    </h2>
                    <p className="text-white/90">{movie.title}</p>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {/* Date Selection */}
                {availableDates.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-600" />
                      Ընտրեք օր
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {availableDates.map((date) => (
                        <button
                          key={date}
                          onClick={() => setSelectedDate(date)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            selectedDate === date
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {date}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Screenings for Selected Date */}
                {selectedDate && screeningsForSelectedDate.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-purple-600" />
                      Ընտրեք ժամ
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {screeningsForSelectedDate.map((screening) => {
                        const availableSeats = getAvailableSeats(screening);
                        const isSoldOut = availableSeats === 0;
                        return (
                          <motion.button
                            key={screening.id}
                            onClick={() =>
                              !isSoldOut && handleScreeningSelect(screening.id)
                            }
                            disabled={isSoldOut}
                            whileHover={!isSoldOut ? { scale: 1.02 } : {}}
                            whileTap={!isSoldOut ? { scale: 0.98 } : {}}
                            className={`p-5 rounded-xl border-2 text-left transition-all ${
                              isSoldOut
                                ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                : 'border-purple-200 hover:border-purple-400 hover:shadow-lg bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Clock
                                  className={`w-5 h-5 ${
                                    isSoldOut
                                      ? 'text-gray-400'
                                      : 'text-purple-600'
                                  }`}
                                />
                                <span className="font-bold text-lg text-gray-900">
                                  {formatTime(screening.startTime)} -{' '}
                                  {formatTime(screening.endTime)}
                                </span>
                              </div>
                              <span
                                className={`text-xl font-bold ${
                                  isSoldOut
                                    ? 'text-gray-400'
                                    : 'text-purple-600'
                                }`}
                              >
                                {screening.basePrice.toFixed(0)} ֏
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1 text-gray-600">
                                <MapPin className="w-4 h-4" />
                                {screening.hall.name}
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {isSoldOut ? (
                                  <span className="text-red-600 font-semibold">
                                    Վաճառված է
                                  </span>
                                ) : (
                                  <span className="text-green-600 font-semibold">
                                    {availableSeats} ազատ
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ) : selectedDate ? (
                  <div className="text-center py-12">
                    <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">
                      Այս օրը ցուցադրություններ չկան
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">Խնդրում ենք ընտրել օր</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {movie.description && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl shadow-lg p-6"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Նկարագրություն
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg">
                  {movie.description}
                </p>
              </motion.div>
            )}

            {/* Screenings */}
            {movie.screenings && movie.screenings.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl shadow-lg p-6"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Ցուցադրություններ
                </h2>

                <div className="space-y-6">
                  {Array.from(screeningsByDate.entries()).map(
                    ([date, screenings]) => (
                      <div key={date}>
                        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-purple-600" />
                          {date}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {screenings
                            ?.filter((s) => isUpcoming(s))
                            .map((screening) => {
                              const availableSeats =
                                getAvailableSeats(screening);
                              const isSoldOut = availableSeats === 0;
                              return (
                                <Link
                                  key={screening.id}
                                  href={SITE_URL.BOOKING(screening.id)}
                                  className={`p-4 rounded-lg border-2 transition-all ${
                                    isSoldOut
                                      ? 'border-gray-300 bg-gray-50 opacity-60 cursor-not-allowed'
                                      : 'border-purple-200 hover:border-purple-400 hover:shadow-md bg-white'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-purple-600" />
                                      <span className="font-semibold text-gray-900">
                                        {formatTime(screening.startTime)} -{' '}
                                        {formatTime(screening.endTime)}
                                      </span>
                                    </div>
                                    <span className="text-lg font-bold text-purple-600">
                                      {screening.basePrice.toFixed(0)} ֏
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-gray-600">
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-4 h-4" />
                                      {screening.hall.name}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Users className="w-4 h-4" />
                                      {isSoldOut ? (
                                        <span className="text-red-600 font-semibold">
                                          Վաճառված է
                                        </span>
                                      ) : (
                                        <span>{availableSeats} ազատ</span>
                                      )}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl shadow-lg p-12 text-center"
              >
                <Ticket className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Ցուցադրություններ չկան
                </h3>
                <p className="text-gray-600 mb-6">
                  Այս ֆիլմի համար մոտալուտ ցուցադրություններ չկան
                </p>
                <Link
                  href={SITE_URL.SCHEDULE}
                  className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  Դիտել բոլոր ցուցադրությունները
                </Link>
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
                Ֆիլմի մասին
              </h3>

              <div className="space-y-4">
                {movie.rating && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Վարկանիշ</div>
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="text-2xl font-bold text-gray-900">
                        {movie.rating.toFixed(1)}
                      </span>
                      <span className="text-gray-500">/ 10</span>
                    </div>
                  </div>
                )}

                {movie.genre && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Ժանր</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {movie.genre}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-gray-500 mb-1">Տևողություն</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatDuration(movie.duration)}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">
                    Թողարկման ամսաթիվ
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatDate(movie.releaseDate)}
                  </div>
                </div>
              </div>

              {movie.screenings && movie.screenings.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-500 mb-2">
                    Մոտալուտ ցուցադրություններ
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {movie.screenings.filter((s) => isUpcoming(s)).length}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
