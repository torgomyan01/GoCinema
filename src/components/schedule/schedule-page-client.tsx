'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Film,
  Ticket,
  ArrowRight,
  MapPin,
  X,
  UserPlus,
  LogIn,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import ScheduleFilter from './schedule-filter';
import { getScreenings } from '@/app/actions/screenings';
import { getMovies } from '@/app/actions/movies';
import { SITE_URL } from '@/utils/consts';

interface Movie {
  id: number;
  title: string;
  slug?: string | null;
}

interface Screening {
  id: number;
  movieId: number;
  hallId: number;
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
  movie?: {
    id: number;
    title: string;
    slug?: string | null;
    image?: string | null;
    duration: number;
  };
  hall?: {
    id: number;
    name: string;
    capacity: number;
  };
  tickets?: Array<{
    id: number;
    status: string;
  }>;
}

export default function SchedulePageClient() {
  const { data: session, status } = useSession();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<number | null>(null);
  const [allScreenings, setAllScreenings] = useState<Screening[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Load data from database
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [screeningsResult, moviesResult] = await Promise.all([
          getScreenings(),
          getMovies(),
        ]);

        if (screeningsResult.success && screeningsResult.screenings) {
          // Get all screenings (including past ones for display)
          const allScreeningsData: Screening[] = (
            screeningsResult.screenings as Screening[]
          ).map((screening) => ({
            ...screening,
            // Calculate if sold out based on tickets
            isSoldOut:
              (screening.tickets?.filter(
                (t) => t.status === 'paid' || t.status === 'reserved'
              ).length || 0) >= (screening.hall?.capacity || 0),
          }));
          setAllScreenings(allScreeningsData);
        }

        if (moviesResult.success && moviesResult.movies) {
          setMovies(
            moviesResult.movies.map((m) => ({
              id: m.id,
              title: m.title,
              slug: m.slug || undefined,
            }))
          );
        }
      } catch (err) {
        console.error('Error loading schedule data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Helper function to get date key consistently
  const getDateKeyFromScreening = (screening: Screening): string => {
    const date = new Date(screening.startTime);
    // Normalize date to local timezone
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    // Format as YYYY-MM-DD directly without ISO conversion
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  // Filter screenings
  const filteredScreenings = useMemo(() => {
    let filtered: Screening[] = [...allScreenings];

    if (selectedMovie) {
      filtered = filtered.filter(
        (screening) => screening.movie?.id === selectedMovie
      );
    }

    return filtered;
  }, [allScreenings, selectedMovie]);

  // Group screenings by date
  const screeningsByDate = useMemo(() => {
    const grouped: Record<string, Screening[]> = {};

    filteredScreenings.forEach((screening) => {
      const dateKey = getDateKeyFromScreening(screening);

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(screening);
    });

    return grouped;
  }, [filteredScreenings]);

  // Generate all days with screenings (all days that have screenings)
  // From already finished days ցույց ենք տալիս միայն վերջին 2 օրը
  const allDays = useMemo(() => {
    // Get all unique dates from screenings using the same key format
    const uniqueDates = new Set<string>();
    filteredScreenings.forEach((screening) => {
      const dateKey = getDateKeyFromScreening(screening);
      uniqueDates.add(dateKey);
    });

    // Convert to Date array and sort
    const datesArray = Array.from(uniqueDates)
      .map((dateStr) => {
        // Parse YYYY-MM-DD string and create Date in local timezone
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      })
      .sort((a, b) => a.getTime() - b.getTime());

    // Split into past and current/future days
    const pastDays = datesArray.filter((d) => isPast(d));
    const currentAndFutureDays = datesArray.filter((d) => !isPast(d));

    // Show only last 2 past days
    const visiblePastDays =
      pastDays.length > 2 ? pastDays.slice(pastDays.length - 2) : pastDays;

    return [...visiblePastDays, ...currentAndFutureDays];
  }, [filteredScreenings]);

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const weekdays = [
      'կիրակի',
      'երկուշաբթի',
      'երեքշաբթի',
      'չորեքշաբթի',
      'հինգշաբթի',
      'ուրբաթ',
      'շաբաթ',
    ];
    const months = [
      'հունվար',
      'փետրվար',
      'մարտ',
      'ապրիլ',
      'մայիս',
      'հունիս',
      'հուլիս',
      'օգոստոս',
      'սեպտեմբեր',
      'հոկտեմբեր',
      'նոյեմբեր',
      'դեկտեմբեր',
    ];
    return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAvailableSeats = (screening: Screening) => {
    const capacity = screening.hall?.capacity || 80;
    const bookedTickets =
      screening.tickets?.filter(
        (t) => t.status === 'paid' || t.status === 'reserved'
      ).length || 0;
    return capacity - bookedTickets;
  };

  const isToday = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  function isPast(date: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  }

  const getDateKey = (date: Date) => {
    // Normalize date to local timezone to avoid timezone issues
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    // Format as YYYY-MM-DD directly without ISO conversion
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  const handleBookingClick = (e: React.MouseEvent, screeningId: number) => {
    if (status !== 'authenticated' || !session) {
      e.preventDefault();
      setShowLoginModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              Ժամանակացույց
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Ընտրեք օրը և ցուցադրությունը
          </p>
        </motion.div>

        {/* Filter - Only Movie Filter */}
        <ScheduleFilter
          selectedDate={null}
          onDateChange={() => {}}
          selectedMovie={selectedMovie}
          onMovieChange={setSelectedMovie}
          movies={movies}
        />

        {/* Schedule Days List */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <p className="mt-4 text-gray-600">Բեռնվում է...</p>
          </div>
        ) : allDays.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600 mb-2">
              Ցուցադրություններ չեն գտնվել
            </p>
            <p className="text-gray-500">
              {selectedMovie
                ? 'Փորձեք փոխել ֆիլտրի պարամետրերը'
                : 'Այս պահին ցուցադրություններ չկան'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {allDays.map((day, dayIndex) => {
              const dateKey = getDateKey(day);
              const dayScreenings = screeningsByDate[dateKey] || [];
              const isTodayDate = isToday(day);
              const isPastDate = isPast(day);

              return (
                <motion.div
                  key={dateKey}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: dayIndex * 0.05 }}
                  className={`group bg-white rounded-2xl shadow-lg border overflow-hidden transition-all duration-300 ${
                    isTodayDate
                      ? 'border-purple-500/80 shadow-purple-200'
                      : isPastDate
                        ? 'border-gray-200 opacity-80'
                        : 'border-gray-200 hover:border-purple-300 hover:-translate-y-1'
                  }`}
                >
                  {/* Day Header */}
                  <div
                    className={`p-5 md:p-6 ${
                      isTodayDate
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-gradient-to-r from-slate-50 to-slate-100 border-b border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/40">
                          <span className="text-xl font-semibold">
                            {day.getDate()}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-wide opacity-90">
                            {isTodayDate ? 'Այսօր' : formatDate(day)}
                          </div>
                          {!isPastDate && !isTodayDate && (
                            <div className="text-xs opacity-80 mt-1">
                              Առկա ցուցադրություններ
                            </div>
                          )}
                          {isPastDate && (
                            <div className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full bg-black/10">
                              <span>Ավարտված օր</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {dayScreenings.length > 0 && (
                        <div
                          className={`text-sm font-semibold ${
                            isTodayDate
                              ? 'text-white opacity-90'
                              : 'text-purple-700'
                          }`}
                        >
                          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 md:bg-white/20 text-xs md:text-sm">
                            <Film className="w-3 h-3" />
                            <span>{dayScreenings.length} ցուցադրություն</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Screenings List */}
                  {dayScreenings.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Ցուցադրություններ չկան</p>
                    </div>
                  ) : (
                    <div className="p-6 max-h-[600px] overflow-y-auto">
                      <div className="space-y-3">
                        {dayScreenings.map((screening) => {
                          const availableSeats = getAvailableSeats(screening);
                          const movieUrl = SITE_URL.MOVIE_DETAIL(
                            screening.movie?.slug ||
                              screening.movie?.id ||
                              screening.movieId
                          );
                          const bookingUrl = SITE_URL.BOOKING(screening.id);

                          return (
                            <motion.div
                              key={screening.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-gray-50 rounded-lg p-4 hover:bg-purple-50 transition-colors border border-gray-100 hover:border-purple-200"
                            >
                              {/* Movie Image */}
                              {screening.movie?.image && (
                                <div className="relative w-full h-[200px] mb-3 rounded overflow-hidden">
                                  <Image
                                    src={screening.movie.image}
                                    alt={screening.movie.title}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              )}

                              {/* Movie Title */}
                              <Link href={movieUrl}>
                                <h4 className="font-semibold text-base text-gray-900 mb-2 hover:text-purple-600 transition-colors line-clamp-2">
                                  {screening.movie?.title || 'Անհայտ ֆիլմ'}
                                </h4>
                              </Link>

                              {/* Time */}
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                                <Clock className="w-4 h-4 text-purple-600" />
                                <span className="font-medium">
                                  {formatTime(screening.startTime)}
                                </span>
                              </div>

                              {/* Hall */}
                              {screening.hall && (
                                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                  <MapPin className="w-4 h-4 text-purple-600" />
                                  <span>{screening.hall.name}</span>
                                </div>
                              )}

                              {/* Available Seats */}
                              <div className="flex items-center gap-2 text-sm mb-3">
                                <Ticket className="w-4 h-4 text-green-600" />
                                <span className="text-gray-600">
                                  <span className="font-semibold text-green-600">
                                    {availableSeats}
                                  </span>{' '}
                                  ազատ նստատեղ
                                </span>
                              </div>

                              {/* Price */}
                              <div className="text-lg font-bold text-purple-600 mb-3">
                                {screening.basePrice.toLocaleString('hy-AM')} ֏
                              </div>

                              {/* Book Button */}
                              {!isPastDate && (
                                <Link
                                  href={bookingUrl}
                                  onClick={(e) =>
                                    handleBookingClick(e, screening.id)
                                  }
                                >
                                  <button
                                    disabled={availableSeats === 0}
                                    className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                  >
                                    {availableSeats === 0
                                      ? 'Վաճառված'
                                      : 'Ամրագրել տոմս'}
                                  </button>
                                </Link>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Login Required Modal */}
        <AnimatePresence>
          {showLoginModal && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLoginModal(false)}
                className="fixed inset-0 bg-black/50 z-50"
              />
              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setShowLoginModal(false)}
              >
                <div
                  className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Film className="w-6 h-6 text-purple-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Գրանցում պահանջվում է
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowLoginModal(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <p className="text-gray-600 mb-6">
                    Տոմս ամրագրելու համար դուք պետք է գրանցված լինեք: Խնդրում
                    ենք մուտք գործել կամ ստեղծել նոր հաշիվ:
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href={SITE_URL.REGISTER}
                      onClick={() => setShowLoginModal(false)}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
                    >
                      <UserPlus className="w-5 h-5" />
                      Գրանցվել
                    </Link>
                    <Link
                      href={SITE_URL.LOGIN}
                      onClick={() => setShowLoginModal(false)}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-all"
                    >
                      <LogIn className="w-5 h-5" />
                      Մուտք գործել
                    </Link>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
