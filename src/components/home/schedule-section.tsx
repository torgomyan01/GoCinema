'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
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
import { isOccupiedTicketStatus } from '@/lib/reservation';

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
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
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
        const now = new Date();
        const result = await getScreenings(now);
        if (result.success && result.screenings) {
          const upcomingScreenings = (result.screenings as Screening[]).sort(
            (a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );

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

  const getLocalDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Group screenings by date
  const screeningsByDate = useMemo(() => {
    const grouped: Record<string, Screening[]> = {};

    screenings.forEach((screening) => {
      const date = new Date(screening.startTime);
      const dateKey = getLocalDateKey(date);

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
      screening.tickets?.filter((t) => isOccupiedTicketStatus(t.status))
        .length || 0;
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

  const getDateKey = getLocalDateKey;

  const shortWeekday = (date: Date) => {
    const weekdays = ['Կիր', 'Երկ', 'Երք', 'Չրք', 'Հնգ', 'Ուրբ', 'Շբթ'];
    return weekdays[date.getDay()];
  };

  const shortMonthDay = (date: Date) => {
    const months = [
      'հնվ', 'փտր', 'մրտ', 'ապր', 'մյս', 'հնս',
      'հլս', 'օգս', 'սեպ', 'հոկ', 'նոյ', 'դեկ',
    ];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const activeDateKey = selectedDateKey ?? getDateKey(new Date());

  useEffect(() => {
    const todayKey = getDateKey(new Date());
    const isTodayInWeek = weekDays.some((day) => getDateKey(day) === todayKey);
    setSelectedDateKey(isTodayInWeek ? todayKey : getDateKey(weekDays[0]));
  }, [weekDays]);

  const renderScreeningCard = (
    screening: Screening,
    isPastDate: boolean
  ) => {
    const availableSeats = getAvailableSeats(screening);
    const movieUrl = SITE_URL.MOVIE_DETAIL(
      screening.movie?.slug || screening.movie?.id || screening.movieId
    );
    const bookingUrl = SITE_URL.BOOKING(screening.id);

    return (
      <motion.div
        key={screening.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-50 rounded-lg p-3 hover:bg-red-50 transition-colors border border-gray-100"
      >
        {screening.movie?.image && (
          <div className="relative w-full h-20 sm:h-24 mb-2 rounded overflow-hidden">
            <Image
              src={screening.movie.image}
              alt={screening.movie.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        <Link href={movieUrl}>
          <h4 className="font-semibold text-sm text-gray-900 mb-2 hover:text-red-600 transition-colors line-clamp-2">
            {screening.movie?.title || 'Անհայտ ֆիլմ'}
          </h4>
        </Link>

        <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
          <Clock className="w-3 h-3 shrink-0" />
          <span>{formatTime(screening.startTime)}</span>
        </div>

        {screening.hall && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{screening.hall.name}</span>
          </div>
        )}

        <div className="flex items-center gap-1 text-xs mb-2">
          <Ticket className="w-3 h-3 text-green-600 shrink-0" />
          <span className="text-gray-600">
            <span className="font-semibold text-green-600">{availableSeats}</span>{' '}
            ազատ
          </span>
        </div>

        <div className="text-xs font-semibold text-red-600 mb-2">
          {screening.basePrice.toLocaleString('hy-AM')} ֏
        </div>

        {!isPastDate && (
          <Link
            href={bookingUrl}
            onClick={(e) => handleBookingClick(e, screening.id)}
          >
            <button
              disabled={availableSeats === 0}
              className="w-full text-xs px-3 py-2 sm:py-1.5 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-lg font-semibold hover:from-red-500 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {availableSeats === 0 ? 'Վաճառված' : 'Ամրագրել'}
            </button>
          </Link>
        )}
      </motion.div>
    );
  };

  const selectedDay =
    weekDays.find((day) => getDateKey(day) === activeDateKey) ?? weekDays[0];
  const selectedDayScreenings = screeningsByDate[activeDateKey] || [];
  const isSelectedDayPast = isPast(selectedDay);

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 sm:mb-10"
        >
          <div className="inline-flex items-center gap-2 mb-3 sm:mb-4 justify-center">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-red-600" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.16em] sm:tracking-[0.2em] text-red-600">
              Սեանսներ
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-red-600" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-2 sm:mb-3">
            Ժամանակացույց
          </h2>
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto px-2">
            Ընտրեք հարմար օրն ու ցուցադրությունը և ամրագրեք ձեր տեղը
          </p>
        </motion.div>

        {/* Calendar Navigation */}
        <div className="mb-5 flex items-center justify-between gap-2 sm:mb-6">
          <button
            onClick={() => navigateWeek('prev')}
            aria-label="Նախորդ շաբաթ"
            className="shrink-0 rounded-lg border border-gray-200 bg-white p-2 shadow-sm transition-colors hover:bg-gray-50"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600 sm:h-6 sm:w-6" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h3 className="truncate text-sm font-semibold text-gray-900 sm:text-lg">
              <span className="sm:hidden">
                {shortMonthDay(weekDays[0])} – {shortMonthDay(weekDays[6])}
              </span>
              <span className="hidden sm:inline">
                {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
              </span>
            </h3>
          </div>
          <button
            onClick={() => navigateWeek('next')}
            aria-label="Հաջորդ շաբաթ"
            className="shrink-0 rounded-lg border border-gray-200 bg-white p-2 shadow-sm transition-colors hover:bg-gray-50"
          >
            <ChevronRight className="h-5 w-5 text-gray-600 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Calendar */}
        {isLoading ? (
          <div className="py-16 text-center sm:py-20">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-red-600 sm:h-12 sm:w-12" />
            <p className="mt-4 text-gray-600">Բեռնվում է...</p>
          </div>
        ) : (
          <>
            {/* Mobile day picker */}
            <div className="mb-4 md:hidden">
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
                {weekDays.map((day) => {
                  const dateKey = getDateKey(day);
                  const isTodayDate = isToday(day);
                  const isSelected = activeDateKey === dateKey;
                  const count = screeningsByDate[dateKey]?.length ?? 0;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDateKey(dateKey)}
                      className={`min-w-[4.5rem] shrink-0 snap-start rounded-2xl border px-3 py-3 text-center transition ${
                        isSelected
                          ? 'border-red-500 bg-red-600 text-white shadow-lg shadow-red-200'
                          : isTodayDate
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <div className="text-[11px] font-semibold uppercase">
                        {shortWeekday(day)}
                      </div>
                      <div className="mt-1 text-xl font-black">{day.getDate()}</div>
                      <div
                        className={`mt-1 text-[10px] ${
                          isSelected ? 'text-red-100' : 'text-gray-400'
                        }`}
                      >
                        {count > 0 ? `${count} սեանս` : '—'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile selected day */}
            <div className="mb-8 md:hidden">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-lg font-bold text-gray-900">
                  {formatDate(selectedDay)}
                </h4>
                {isToday(selectedDay) && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                    Այսօր
                  </span>
                )}
              </div>

              {selectedDayScreenings.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-gray-400">
                  <Film className="mx-auto mb-3 h-10 w-10 opacity-30" />
                  <p className="text-sm">Այս օրվա ցուցադրություններ չկան</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectedDayScreenings.map((screening) => (
                    <Fragment key={screening.id}>
                      {renderScreeningCard(screening, isSelectedDayPast)}
                    </Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop week grid */}
            <div className="mb-8 hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-7">
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
                  className={`overflow-hidden rounded-xl border-2 bg-white shadow-lg md:min-h-[320px] lg:min-h-[400px] ${
                    isTodayDate
                      ? 'border-red-500 shadow-red-200'
                      : isPastDate
                        ? 'border-gray-200 opacity-60'
                        : 'border-gray-200 hover:border-red-300'
                  }`}
                >
                  {/* Day Header */}
                  <div
                    className={`p-4 text-center ${
                      isTodayDate
                        ? 'bg-gradient-to-r from-red-600 to-red-800 text-white'
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
                  <div className="max-h-[280px] space-y-2 overflow-y-auto p-3 lg:max-h-[350px]">
                    {dayScreenings.length === 0 ? (
                      <div className="py-8 text-center text-sm text-gray-400">
                        <Film className="mx-auto mb-2 h-8 w-8 opacity-30" />
                        <p>Ցուցադրություններ չկան</p>
                      </div>
                    ) : (
                      dayScreenings.map((screening) => (
                        <Fragment key={screening.id}>
                          {renderScreeningCard(screening, isPastDate)}
                        </Fragment>
                      ))
                    )}
                  </div>
                </motion.div>
              );
            })}
            </div>
          </>
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-red-600 bg-white px-6 py-3.5 text-base font-bold text-red-600 shadow-lg transition-all duration-300 hover:bg-red-600 hover:text-white hover:shadow-xl sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
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
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-lg font-semibold hover:from-red-500 hover:to-red-700 transition-all shadow-md hover:shadow-lg"
                    >
                      <UserPlus className="w-5 h-5" />
                      Գրանցվել
                    </Link>
                    <Link
                      href={SITE_URL.LOGIN}
                      onClick={() => setShowLoginModal(false)}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-red-600 text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-all"
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
