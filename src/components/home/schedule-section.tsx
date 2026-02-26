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
  ChevronLeft,
  ChevronRight,
  X,
  UserPlus,
  LogIn,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { SITE_URL } from '@/utils/consts';
import { getScreenings } from '@/app/actions/screenings';

interface Screening {
  id: number;
  movieId: number;
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

export default function ScheduleSection() {
  const { data: session, status } = useSession();
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day; // Get Sunday of current week
    const sunday = new Date(today.setDate(diff));
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  });

  useEffect(() => {
    const loadScreenings = async () => {
      setIsLoading(true);
      try {
        const result = await getScreenings();
        if (result.success && result.screenings) {
          // Get next 7 days screenings
          const now = new Date();
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 7);

          const upcomingScreenings = (result.screenings as Screening[])
            .filter((screening) => {
              const startTime = new Date(screening.startTime);
              return startTime >= now && startTime <= nextWeek;
            })
            .sort((a, b) => {
              return (
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime()
              );
            });

          setScreenings(upcomingScreenings);
        }
      } catch (err) {
        console.error('Error loading screenings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadScreenings();
  }, []);

  // Group screenings by date
  const screeningsByDate = useMemo(() => {
    const grouped: Record<string, Screening[]> = {};

    screenings.forEach((screening) => {
      const date = new Date(screening.startTime);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(screening);
    });

    return grouped;
  }, [screenings]);

  // Generate week days (7 days starting from current week start)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentWeekStart]);

  const handleBookingClick = (e: React.MouseEvent, screeningId: number) => {
    if (status !== 'authenticated' || !session) {
      e.preventDefault();
      setShowLoginModal(true);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

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

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const getDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <section className="py-20 bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900">
              Ժամանակացույց
            </h2>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Ընտրեք օրը և ցուցադրությունը
          </p>
        </motion.div>

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">
              {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
            </h3>
          </div>
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Calendar Grid */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <p className="mt-4 text-gray-600">Բեռնվում է...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
            {weekDays.map((day, dayIndex) => {
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
                  className={`bg-white rounded-xl shadow-lg border-2 overflow-hidden min-h-[400px] ${
                    isTodayDate
                      ? 'border-purple-500 shadow-purple-200'
                      : isPastDate
                        ? 'border-gray-200 opacity-60'
                        : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  {/* Day Header */}
                  <div
                    className={`p-4 text-center ${
                      isTodayDate
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-gray-50 border-b border-gray-200'
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">
                      {formatDate(day).split(',')[0]}
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        isTodayDate ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {day.getDate()}
                    </div>
                    {isTodayDate && (
                      <div className="text-xs mt-1 opacity-90">Այսօր</div>
                    )}
                  </div>

                  {/* Screenings List */}
                  <div className="p-3 space-y-2 max-h-[350px] overflow-y-auto">
                    {dayScreenings.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        <Film className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>Ցուցադրություններ չկան</p>
                      </div>
                    ) : (
                      dayScreenings.map((screening) => {
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
                            className="bg-gray-50 rounded-lg p-3 hover:bg-purple-50 transition-colors border border-gray-100"
                          >
                            {/* Movie Image */}
                            {screening.movie?.image && (
                              <div className="relative w-full h-24 mb-2 rounded overflow-hidden">
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
                              <h4 className="font-semibold text-sm text-gray-900 mb-2 hover:text-purple-600 transition-colors line-clamp-2">
                                {screening.movie?.title || 'Անհայտ ֆիլմ'}
                              </h4>
                            </Link>

                            {/* Time */}
                            <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(screening.startTime)}</span>
                            </div>

                            {/* Hall */}
                            {screening.hall && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                <MapPin className="w-3 h-3" />
                                <span>{screening.hall.name}</span>
                              </div>
                            )}

                            {/* Available Seats */}
                            <div className="flex items-center gap-1 text-xs mb-2">
                              <Ticket className="w-3 h-3 text-green-600" />
                              <span className="text-gray-600">
                                <span className="font-semibold text-green-600">
                                  {availableSeats}
                                </span>{' '}
                                ազատ
                              </span>
                            </div>

                            {/* Price */}
                            <div className="text-xs font-semibold text-purple-600 mb-2">
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
                                  className="w-full text-xs px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {availableSeats === 0
                                    ? 'Վաճառված'
                                    : 'Ամրագրել'}
                                </button>
                              </Link>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* View All Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <Link
            href={SITE_URL.SCHEDULE}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white border-2 border-purple-600 text-purple-600 rounded-xl font-semibold text-lg hover:bg-purple-600 hover:text-white transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <Calendar className="w-5 h-5" />
            Դիտել ամբողջ ժամանակացույցը
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>

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
    </section>
  );
}
