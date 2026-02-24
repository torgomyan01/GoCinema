'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  MapPin,
  Ticket,
  X,
  UserPlus,
  LogIn,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { SITE_URL } from '@/utils/consts';

interface Screening {
  id: number;
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
    capacity?: number;
  };
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
  isSoldOut?: boolean;
  tickets?: Array<{
    id: number;
    status: string;
  }>;
}

interface ScheduleDayProps {
  date: Date;
  screenings: Screening[];
}

export default function ScheduleDay({ date, screenings }: ScheduleDayProps) {
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleBookingClick = (e: React.MouseEvent, screeningId: number) => {
    // Check if user is authenticated
    if (status !== 'authenticated' || !session) {
      e.preventDefault();
      setShowLoginModal(true);
    }
    // If authenticated, let the Link handle navigation
  };

  const formatDate = (date: Date) => {
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
    return `${weekdays[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  if (screenings.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold text-gray-900">{formatDate(date)}</h2>
        {isToday(date) && (
          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
            Այսօր
          </span>
        )}
      </div>

      <div className="space-y-4">
        {screenings.map((screening) => (
          <motion.div
            key={screening.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden"
          >
            <div className="flex flex-col md:flex-row">
              {/* Movie Image */}
              {screening.movie && (
                <div className="relative w-full md:w-48 h-48 md:h-auto overflow-hidden bg-gray-200">
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

              {/* Content */}
              <div className="flex-1 p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    {screening.movie ? (
                      <Link
                        href={SITE_URL.MOVIE_DETAIL(
                          screening.movie.slug || screening.movie.id
                        )}
                        className="text-xl font-bold text-gray-900 hover:text-purple-600 transition-colors mb-2 block"
                      >
                        {screening.movie.title}
                      </Link>
                    ) : (
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        Անհայտ ֆիլմ
                      </h3>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {formatTime(screening.startTime)} -{' '}
                          {formatTime(screening.endTime)}
                        </span>
                      </div>
                      {screening.hall && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{screening.hall.name}</span>
                        </div>
                      )}
                      {screening.movie && (
                        <div className="flex items-center gap-1">
                          <Ticket className="w-4 h-4" />
                          <span>{screening.movie.duration} րոպե</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {screening.basePrice.toFixed(0)} ֏
                      </div>
                      <div className="text-sm text-gray-500">մեկ տոմս</div>
                    </div>

                    {screening.isSoldOut ? (
                      <button
                        disabled
                        className="px-6 py-2 bg-gray-300 text-gray-600 rounded-lg font-semibold cursor-not-allowed"
                      >
                        Վաճառված է
                      </button>
                    ) : (
                      <Link
                        href={SITE_URL.BOOKING(screening.id)}
                        onClick={(e) => handleBookingClick(e, screening.id)}
                        className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-md hover:shadow-lg"
                      >
                        Ամրագրել
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

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
                      <AlertCircle className="w-6 h-6 text-purple-600" />
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
                  Տոմս ամրագրելու համար դուք պետք է գրանցված լինեք: Խնդրում ենք
                  մուտք գործել կամ ստեղծել նոր հաշիվ:
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
    </motion.div>
  );
}
